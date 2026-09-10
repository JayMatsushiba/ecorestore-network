# Deploying the demonstration to AWS

`main` deploys itself. Every push to `main` runs the test suites, builds the three
images, pushes them to ECR and restarts the stack on one EC2 host, which also runs the
Hedera Guardian quickstart when asked to. This directory holds everything that is not a
workflow: the one-time infrastructure, the AWS compose overlay, and the scripts that run
on the host.

```text
.github/workflows/ci.yml        every suite, on every branch and PR
.github/workflows/deploy.yml    main → CI → ECR → SSM → docker compose up → smoke test
.github/workflows/guardian.yml  manual: Guardian quickstart up / down / status / logs

deploy/cloudformation/demo-host.yml   the host, ECR, and the GitHub↔AWS trust (run once)
deploy/docker-compose.aws.yml         prebuilt images + Caddy edge, layered on docker-compose.yml
deploy/caddy/Caddyfile                :80, or automatic HTTPS when DOMAIN is set
deploy/guardian/docker-compose.public.yml   publishes Guardian's web proxy on :3000
deploy/host/deploy.sh                 what the Deploy workflow runs on the host
deploy/host/guardian.sh               what the Guardian workflow runs on the host
```

What the host runs is the local stack from `docs/DEPLOYMENT.md` §7, unchanged: the same
compose file, the same trust boundaries (`analysis` on an internal-only network with no
keys and no egress; `verify` the only holder of `VERIFIER_SEED`; the frontend talking to
`verify` alone), with the images pulled instead of built and a Caddy container in front
of the frontend's nginx. Guardian runs beside it from its own checkout, exactly as it
does locally (§7.6, §7.7).

## How a deploy works

1. `deploy.yml` calls `ci.yml`: typecheck + vitest, frontend lint + build, pytest
   parity, `forge test`, and a clean `docker compose build`. A red suite stops here.
2. Three matrix jobs assume the deploy role through GitHub's OIDC provider (no AWS keys
   stored in GitHub), log in to ECR and push `ecorestore/{analysis,verify,frontend}`
   tagged with the commit SHA and `latest`, with a registry build cache.
3. The deploy job sends one SSM Run Command to the instance. On the host it advances
   `/opt/ecorestore/app` to the deployed commit and runs `deploy/host/deploy.sh <sha>`,
   which reads configuration from SSM Parameter Store, logs in to ECR with the instance
   role, attaches to Guardian's network if the quickstart is running (otherwise the
   stack runs standalone and stages Guardian requests to the outbox, saying so), and
   runs `docker compose up -d --wait`.
4. The job polls the command to completion, prints the host's output, and smoke-tests
   `DEMO_URL/health` and the page.

No secret passes through GitHub. The host reads `/ecorestore/demo/*` and
`/ecorestore/guardian/*` from Parameter Store at run time and exports them to compose
for the life of the process; nothing is written to a `.env` (`docs/DEPLOYMENT.md` §8).
There is no SSH: the security group opens 80/443 (and 3000 for the Guardian UI if
enabled); the host is reached only through SSM.

## One-time setup

You need: an AWS account and region, the AWS CLI logged in with rights to create IAM
roles, EC2, ECR and SSM parameters, and `gh` logged in to the repository.

### 1. Create the stack

```bash
aws cloudformation deploy \
  --stack-name ecorestore-demo \
  --template-file deploy/cloudformation/demo-host.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides VpcId=vpc-xxxxxxxx SubnetId=subnet-xxxxxxxx
# Optional overrides: InstanceType=t3.2xlarge  GuardianUiCidr=""  CreateGitHubOidcProvider=false
aws cloudformation describe-stacks --stack-name ecorestore-demo \
  --query 'Stacks[0].Outputs' --output table
```

The user-data installs Docker and the compose plugin, clones this repository to
`/opt/ecorestore/app` and Guardian at tag `3.7.0` to `/opt/ecorestore/guardian`. Give it a
few minutes; `/opt/ecorestore/BOOTSTRAPPED` appears when it is done
(`aws ssm start-session --target <InstanceId>` to look).

If the account already has a GitHub OIDC provider (`aws iam list-open-id-connect-providers`),
pass `CreateGitHubOidcProvider=false`.

### 2. Parameters the host reads

```bash
# Required
aws ssm put-parameter --name /ecorestore/demo/ECR_REGISTRY --type String \
  --value "$(aws cloudformation describe-stacks --stack-name ecorestore-demo \
             --query 'Stacks[0].Outputs[?OutputKey==`EcrRegistry`].OutputValue' --output text)"
aws ssm put-parameter --name /ecorestore/demo/VERIFIER_SEED --type SecureString --value '<long random string>'

# Optional
aws ssm put-parameter --name /ecorestore/demo/DOMAIN --type String --value demo.example.org   # → HTTPS via Caddy
aws ssm put-parameter --name /ecorestore/demo/GUARDIAN_POLICY_ID  --type String --value '<policy id once one is published>'
aws ssm put-parameter --name /ecorestore/demo/GUARDIAN_BLOCK_TAG  --type String --value ecorestore_verdict_ingest
aws ssm put-parameter --name /ecorestore/demo/GUARDIAN_POLICY_TAG --type String --value Ecorestore_Riparian_v1

# Guardian (only needed for the Guardian workflow's `up`)
aws ssm put-parameter --name /ecorestore/guardian/OPERATOR_ID  --type String       --value 0.0.xxxxxxx
aws ssm put-parameter --name /ecorestore/guardian/OPERATOR_KEY --type SecureString --value '<testnet ED25519 DER private key>'
```

`VERIFIER_SEED` is the root of every credential the demonstration signs; generate a
fresh value for the deployment and never reuse the local default. Testnet key material
only, on every parameter.

Do **not** set `DEMO_RPC_URL` on the host. On AWS the settlement calldata is prepared
and shown, not broadcast; a demonstration chain is not run there (`docs/DEPLOYMENT.md` §4).

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

Then create the `demo` environment in the repository settings (Settings → Environments)
so the deploy role's trust policy, which accepts jobs bound to `environment:demo`, is
satisfied. Add required reviewers there if a human gate before each deploy is wanted.

### 4. Branch protection

`main` is protected: the five CI jobs (`typescript`, `frontend`, `analysis`,
`contracts`, `images`) must pass on a pull request before it can be merged, force
pushes and deletion are blocked, and the rule applies to administrators too, so a
direct push to `main` is rejected. Work on a branch and merge through a PR. The rule
was created with the GitHub API and is not managed by anything in the repository;
to inspect or re-apply it:

```bash
gh api repos/JayMatsushiba/ecorestore-network/branches/main/protection \
  -q '.required_status_checks.checks[].context'
```

If a CI job is renamed, update the rule's contexts or merges will wait forever for a
check that never reports.

### 5. First deploy

Push to `main`, or run **Deploy** from the Actions tab. The environment link on the
workflow run points at the site.

## Guardian

Guardian is switched on for a judging window, not on every push. From the Actions tab
run **Guardian** with `up`; it pulls the `3.7.0` images, starts the quickstart with
`deploy/guardian/docker-compose.public.yml` layered on top (which publishes only the web
proxy, on `:3000`), and waits for the UI. Then run **Deploy** once so `verify` joins
`guardian-quickstart_default` and starts POSTing verdicts to `http://web-proxy:80`.

`down` stops the containers and keeps the MongoDB and IPFS volumes; run **Deploy** again
afterwards so `verify` returns to outbox mode. `status` and `logs` do what they say.

A `200` from Guardian's external-data endpoint is delivery, not a policy run; the
interface reports it as *gateway acknowledged*. No policy has been authored or
published, so nothing consumes the verdict yet (`docs/DEPLOYMENT.md` §7.6).

## Changing the host

The stack is the only thing that describes the host. Change the template and re-run
`aws cloudformation deploy`. Changing `InstanceType` restarts the instance; the
checkouts and Docker volumes on the root disk survive. Deleting the stack deletes the
host and the EIP; the ECR repositories are deleted with it, so pull anything you want
to keep first.

## Cost

The instance dominates: a `t3.xlarge` on demand is on the order of $120/month, most of
it justified only while Guardian is running. Stop the instance between judging
windows (`aws ec2 stop-instances`); the EIP persists, and the next `start-instances`
plus a **Deploy** run brings the site back at the same address.
