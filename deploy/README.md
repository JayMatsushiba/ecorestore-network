# Deploying the demonstration to AWS

`main` deploys itself. Every push to `main` runs the test suites, builds two images,
pushes them to ECR and restarts the demo stack on one EC2 host. This directory holds
everything that is not a workflow: the one-time infrastructure, the AWS compose
overlay, and the script that runs on the host.

```text
.github/workflows/ci.yml        every suite, on every branch and PR
.github/workflows/deploy.yml    main → CI → ECR → SSM → docker compose up → smoke test

deploy/cloudformation/demo-host.yml   the host, ECR, and the GitHub↔AWS trust (run once)
deploy/docker-compose.aws.yml         prebuilt images + Caddy edge, layered on docker-compose.yml
deploy/caddy/Caddyfile                :80, or automatic HTTPS when DOMAIN is set
deploy/host/deploy.sh                 what the Deploy workflow runs on the host
```

What the host runs is the local demo stack from `docker-compose.yml`, unchanged: a
Hardhat in-memory chain, Graph Node with Postgres and IPFS, the one-shot bootstrap
that settles the synthetic demo deed and deploys the subgraph, the read-only API
(`server/`), and nginx serving the React build — with the images pulled instead of
built and a Caddy container in front of nginx. Putting it on a public URL makes none
of it more real: no Arc, no real USDC, no Hedera Guardian, no field measurement. The
UI's synthetic-data disclaimers stay.

## How a deploy works

1. `deploy.yml` calls `ci.yml`: typecheck + vitest, frontend lint + tests + build,
   the Hardhat contract suite, and a clean `docker compose build`. A red suite stops here.
2. Two matrix jobs assume the deploy role through GitHub's OIDC provider (no AWS keys
   stored in GitHub), log in to ECR and push `ecorestore/app` (the chain, bootstrap and
   api services) and `ecorestore/frontend`, tagged with the commit SHA and `latest`,
   with a registry build cache.
3. The deploy job sends one SSM Run Command to the instance. On the host it advances
   `/opt/ecorestore/app` to the deployed commit and runs `deploy/host/deploy.sh <sha>`,
   which reads `ECR_REGISTRY` (and the optional `DOMAIN`) from SSM Parameter Store, logs
   in to ECR with the instance role, pulls, takes the stack down **including the chain,
   Graph Node and deployment-record volumes**, and runs `docker compose up -d --wait`.
   Bootstrap then re-runs the settlement on the fresh chain and redeploys the subgraph;
   the script returns once the API reports the deed indexed.
4. The job polls the command to completion, prints the host's output, and smoke-tests
   `DEMO_URL/api/health`, `DEMO_URL/api/deed` (must be `OK`) and the page.

Every deploy is a fresh chain, because Hardhat's network lives in memory. That is also
what happens after a host reboot: the containers restart, but the chain is empty and
the index stale, so run **Deploy** again (Actions tab, `workflow_dispatch`) to bootstrap
it. Caddy's volumes are the only ones a deploy keeps, so a certificate obtained for
`DOMAIN` is not re-requested each time.

No secret passes through GitHub and none exists on the host: the stack has no deployer
key, no RPC credential and no real token. There is no SSH: the security group opens
80/443; the host is reached only through SSM.

## One-time setup

You need: an AWS account and region, the AWS CLI logged in with rights to create IAM
roles, EC2, ECR and SSM parameters, and `gh` logged in to the repository.

### 1. Create or update the stack

Find the default VPC and one of its public subnets, then create the stack with those
real IDs (placeholders fail parameter validation and leave the stack in
`ROLLBACK_COMPLETE`, which must be deleted with `aws cloudformation delete-stack`
before trying again):

```bash
aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[].VpcId' --output text
aws ec2 describe-subnets --filters Name=default-for-az,Values=true \
  --query 'Subnets[].[SubnetId,AvailabilityZone,MapPublicIpOnLaunch]' --output text

aws cloudformation deploy \
  --stack-name ecorestore-demo \
  --template-file deploy/cloudformation/demo-host.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides VpcId=<vpc id> SubnetId=<subnet id>
# Optional overrides: InstanceType=t3.2xlarge  CreateGitHubOidcProvider=false
aws cloudformation describe-stacks --stack-name ecorestore-demo \
  --query 'Stacks[0].Outputs' --output table
```

**An existing stack needs this same command run once** before the first deploy of this
stack shape: it adds the `ecorestore/app` ECR repository and lets the deploy role push
to it. The `ecorestore/analysis` and `ecorestore/verify` repositories from the previous
shape are kept by the template until their removal is decided; the instance, EIP and
roles are untouched by the update.

The user-data installs Docker and the compose plugin and clones this repository to
`/opt/ecorestore/app` (it also clones the Hedera Guardian quickstart, which this stack
does not use). Give it a few minutes; `/opt/ecorestore/BOOTSTRAPPED` appears when it is
done (`aws ssm start-session --target <InstanceId>` to look).

If the account already has a GitHub OIDC provider (`aws iam list-open-id-connect-providers`),
pass `CreateGitHubOidcProvider=false`.

The deploy role's trust policy names the repository two ways, because GitHub's OIDC
subject changed: repositories created after 2026-07-15 present
`repo:<owner>@<ownerId>/<repo>@<repoId>:environment:demo` rather than
`repo:<owner>/<repo>:environment:demo`. The template defaults `GitHubOwnerId` and
`GitHubRepositoryId` to this repository's ids; for a fork, pass the values of
`gh api repos/<owner>/<repo> -q '.owner.id, .id'`. A mismatch fails every build job
with `Not authorized to perform sts:AssumeRoleWithWebIdentity`, and CloudTrail
(`AssumeRoleWithWebIdentity`, in the stack's region) shows the subject that was
presented.

### 2. Parameters the host reads

```bash
# Required
aws ssm put-parameter --name /ecorestore/demo/ECR_REGISTRY --type String \
  --value "$(aws cloudformation describe-stacks --stack-name ecorestore-demo \
             --query 'Stacks[0].Outputs[?OutputKey==`EcrRegistry`].OutputValue' --output text)"

# Optional
aws ssm put-parameter --name /ecorestore/demo/DOMAIN --type String --value demo.example.org   # → HTTPS via Caddy
```

Nothing else. Parameters left over from the previous stack shape (`VERIFIER_SEED`,
`GUARDIAN_*`) are ignored and can be deleted.

### 3. Tell GitHub about the stack

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body "$(aws cloudformation describe-stacks --stack-name ecorestore-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`DeployRoleArn`].OutputValue' --output text)"
gh variable set AWS_REGION      --body "$(aws configure get region)"
gh variable set EC2_INSTANCE_ID --body "$(aws cloudformation describe-stacks --stack-name ecorestore-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' --output text)"
gh variable set DEMO_URL        --body "$(aws cloudformation describe-stacks --stack-name ecorestore-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`DemoUrl`].OutputValue' --output text)"
```

Then create the `demo` environment **restricted to protected branches**. A job bound
to an environment presents `repo:…:environment:demo` as its OIDC subject rather than
the branch, so the environment's deployment-branch policy is what stops a workflow run
on some other branch from assuming the deploy role. `main` is the only protected
branch (step 4), so this pins deploys to `main`:

```bash
gh api -X PUT repos/JayMatsushiba/ecorestore-network/environments/demo \
  --input - <<'JSON'
{"deployment_branch_policy": {"protected_branches": true, "custom_branch_policies": false}}
JSON
```

Add required reviewers to the environment (Settings → Environments → demo) if a human
gate before each deploy is wanted.

### 4. Branch protection

`main` is protected: the four CI jobs (`typescript`, `frontend`, `contracts`, `images`)
must pass on a pull request before it can be merged, force pushes and deletion are
blocked, and the rule applies to administrators too, so a direct push to `main` is
rejected. Work on a branch and merge through a PR. The rule was created with the
GitHub API and is not managed by anything in the repository; to inspect or re-apply it:

```bash
gh api repos/JayMatsushiba/ecorestore-network/branches/main/protection \
  -q '.required_status_checks.checks[].context'
gh api -X PATCH repos/JayMatsushiba/ecorestore-network/branches/main/protection/required_status_checks \
  --input - <<'JSON'
{"strict": false, "contexts": ["typescript", "frontend", "contracts", "images"]}
JSON
```

If a CI job is renamed, update the rule's contexts or merges will wait forever for a
check that never reports.

### 5. First deploy

Push to `main`, or run **Deploy** from the Actions tab. The environment link on the
workflow run points at the site.

## Changing the host

The stack is the only thing that describes the host. Change the template and re-run
`aws cloudformation deploy`. Changing `InstanceType` restarts the instance; the
checkout and Docker volumes on the root disk survive (and a **Deploy** run is needed
afterwards to bootstrap the fresh chain). Deleting the stack deletes the host, the EIP
and the ECR repositories **including every image in them** (`EmptyOnDelete` is set so
the delete does not fail on non-empty repositories); pull anything you want to keep first.

## Cost

The instance dominates: a `t3.xlarge` on demand is on the order of $120/month. Stop the
instance between judging windows (`aws ec2 stop-instances`); the EIP persists, and the
next `start-instances` plus a **Deploy** run brings the site back at the same address.
