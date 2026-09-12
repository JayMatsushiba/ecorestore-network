# Ecorestore Network — AWS Deployment Guide

> **Status: NOT YET DEPLOYED.** This is a deployment guide, not a record of a completed deployment — no AWS resource has been created for this project in any session. Nothing here has been executed or verified against a real AWS account. Treat it as implementation-ready instructions for whoever performs the first deployment (M7 scope, see `docs/M6_M7_READINESS_REPORT.md`), not as proof it works. Run the local demo first (`README.md`) to confirm the application itself works before troubleshooting cloud infrastructure on top of it.
>
> This guide covers **hosting the existing local-demo architecture on AWS** (same Mock Guardian, MockUSDC, local Hardhat chain, local Graph Node — just running on a rented server instead of a laptop, so it's reachable at a public URL). It does **not** cover deploying to a real Arc Testnet/Mainnet, live Hedera Guardian, or real USDC — those are separate, larger pieces of work with their own credential and audit requirements (`docs/M6_M7_READINESS_REPORT.md` §8-9).

---

## 1. What "running on AWS" means here

Nothing about the architecture changes — the same components from `README.md` run on a cloud host instead of your laptop:

```text
EC2 instance (or equivalent)
├── Persistent Hardhat node          (systemd/pm2, port 8545, localhost-only)
├── Docker: Postgres + IPFS + Graph Node   (subgraph/docker-compose.yml, unchanged)
├── Demo API server (server/)         (systemd/pm2, port 4000, localhost-only)
├── React production build (app/)     (static files, served by nginx)
└── nginx                              (reverse proxy + TLS; the only public entry point)
```

Only nginx's ports (80/443) should ever be reachable from the internet. Everything else — Hardhat's RPC, Graph Node's admin/GraphQL ports, the API server — stays bound to `localhost` and is reached by nginx internally.

---

## 2. Prerequisites

- An AWS account with permission to create EC2 instances, security groups, and (optionally) an Elastic IP / Route 53 record.
- The AWS CLI configured locally (`aws configure`) if you want to script instance creation — the console works too.
- An SSH key pair for EC2 access.
- (Optional) A domain name if you want a real URL instead of the instance's public IP.

**No Arc, Hedera, or USDC credentials are needed for this guide** — it hosts the same local/mock demo, not a production deployment.

---

## 3. Launch the instance

Graph Node + Postgres + IPFS + a Hardhat node + Node.js all running on one host need real memory — undersizing this is the most common failure mode.

- **AMI:** Ubuntu Server 22.04 LTS
- **Instance type:** `t3.xlarge` (4 vCPU / 16 GiB) recommended; `t3.large` (8 GiB) is a minimum, not comfortable
- **Storage:** 30+ GiB gp3 (Docker images + Postgres + node_modules add up)
- **Security group:**
  | Port | Source | Purpose |
  |---|---|---|
  | 22 | your IP only | SSH |
  | 80 | `0.0.0.0/0` | HTTP (redirect to HTTPS) |
  | 443 | `0.0.0.0/0` | HTTPS — the only application entry point |
  | 8545, 5432, 5001, 8000-8040, 4000 | **not exposed** | Hardhat RPC, Postgres, IPFS, Graph Node, API server — internal only, reached via nginx or localhost |

```bash
# Example via AWS CLI (adjust VPC/subnet/AMI id for your account/region)
aws ec2 run-instances \
  --image-id ami-xxxxxxxx \
  --instance-type t3.xlarge \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxx \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ecorestore-demo}]'
```

Attach an Elastic IP (or use Route 53 with the instance's public IP) so the address is stable across restarts.

---

## 4. Install prerequisites on the instance

```bash
ssh -i your-key.pem ubuntu@<instance-public-ip>

# Node.js 24.x (matches this project's development version)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker + Compose plugin
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin nginx git
sudo usermod -aG docker ubuntu
newgrp docker

# Process manager for the long-running Node processes
sudo npm install -g pm2

node --version   # expect v24.x
docker --version
```

---

## 5. Clone and install

```bash
git clone <this repository> ecorestore-network
cd ecorestore-network
npm install
cd subgraph && npm install && cd ..
cd app && npm install && cd ..
```

---

## 6. Start the persistent chain and run the demo settlement

```bash
# Persistent Hardhat node — bind to all interfaces so the Graph Node
# container (via host.docker.internal) can reach it; the security group
# still keeps 8545 unreachable from the internet.
pm2 start "npx hardhat node --hostname 0.0.0.0" --name hardhat-node
pm2 save

# Real M1 -> M2 -> Arc chain against it (writes subgraph/deployment.local.json)
npm run demo:local
```

---

## 7. Bring up the Graph Node stack and deploy the subgraph

```bash
cd subgraph
docker compose up -d
# wait for graph-node to report healthy (see docs/GRAPH.md §7.14 for the check command)

npm run configure
npm run codegen
npm run build
npm run create-local
npm run deploy-local
cd ..
```

`subgraph/docker-compose.yml`'s `extra_hosts: host.docker.internal:host-gateway` entry works on Linux Docker Engine 20.10+ (which Ubuntu 22.04's `docker.io` package provides) exactly as it does locally — no change needed for the Graph Node → Hardhat connection.

---

## 8. Build and run the API server and React app

```bash
# API server
pm2 start "npm run server" --name ecorestore-api
pm2 save

# React production build — point it at nginx's public path for the API,
# not localhost:4000, since the browser (not this server) makes the request.
cd app
echo "VITE_API_BASE_URL=https://your-domain.example/api" > .env.production.local
npm run build
cd ..
```

---

## 9. Configure nginx as the single public entry point

```nginx
# /etc/nginx/sites-available/ecorestore
server {
    listen 80;
    server_name your-domain.example;

    # React static build
    root /home/ubuntu/ecorestore-network/app/dist;
    index index.html;
    location / {
        try_files $uri /index.html;
    }

    # Demo API server
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
    }

    # Optional: expose GraphQL directly for judges/developers to query
    location /graphql/ {
        proxy_pass http://127.0.0.1:8000/subgraphs/name/ecorestore/restoration-deed/;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ecorestore /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Note the app was built with `VITE_API_BASE_URL=https://your-domain.example/api` — update `server/index.ts`'s route handling isn't affected, but the browser now calls nginx, which proxies to the local API server (port 4000 stays unreachable from the internet directly).

---

## 10. HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

Certbot rewrites the nginx config to redirect port 80 → 443 and installs a Let's Encrypt certificate, renewed automatically via its own systemd timer.

---

## 11. Verify

```bash
curl -s https://your-domain.example/api/health          # {"status":"OK"}
curl -s https://your-domain.example/api/deed             # real indexed deed state
```

Then open `https://your-domain.example` in a browser and walk through the same pages described in `docs/DEMO.md`.

---

## 12. Restart / redeploy

```bash
pm2 restart all                    # after a code change to server/ (no rebuild needed, tsx runs .ts directly)
cd app && npm run build && cd ..   # after a UI change — nginx serves the new dist/ immediately
```

A fresh Hardhat node (e.g. after an instance reboot without `pm2 save`/`pm2 resurrect` configured) means a fresh chain with no deployed contract — repeat steps 6-7.

```bash
pm2 startup   # follow its printed instructions once, so pm2 processes survive a reboot
pm2 save
```

---

## 13. Known limitations of this deployment path

Everything in `docs/M6_M7_READINESS_REPORT.md`'s BLOCKER and HIGH lists still applies once this is reachable at a public URL — most importantly:

- **`server/`'s API has no authentication.** Anyone who can reach `/api/*` can query it. It's read-only (no fund-release path exists), but it is still an uncontrolled information-exposure surface. Consider adding at least a shared-secret header checked by nginx (`auth_request` or a simple `map` block) before putting a real URL in front of judges/the public.
- This hosts the **same Mock Guardian, MockUSDC, and local Hardhat chain** as the local demo — putting it on a public URL does not make any of it more real. Keep the UI's synthetic-data disclaimer and "local demo only" language intact; do not remove it just because the demo now has a real-looking URL.
- A single EC2 instance is a single point of failure with no redundancy — acceptable for a hackathon demo, not for anything with real users.
- This guide does not provision a secrets manager, because nothing here requires a secret yet. The moment a real Arc Testnet deployer key or Hedera credential is introduced, move it into AWS Secrets Manager immediately — never into an EC2 file, environment variable in `~/.bashrc`, or the repository.

---

## 14. The larger, AWS-native production path (not this guide)

For reference, `docs/M6_M7_READINESS_REPORT.md` §8 sketches the eventual production shape — ECS Fargate (or App Runner) for the API, RDS for Graph Node's Postgres, S3 + CloudFront for the static React build, Secrets Manager for a real deployer key, and a real Arc Testnet/Mainnet RPC endpoint instead of a local Hardhat node. That is materially more work (container images, task definitions, IAM roles, a VPC design) and depends on M7's Guardian/Arc trust-boundary work landing first — it is not a bigger version of this guide, it is a different, later milestone.
