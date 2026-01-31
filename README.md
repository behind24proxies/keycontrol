<img width="248" height="78" alt="image" src="https://github.com/user-attachments/assets/97d1869d-8f66-4f84-9f42-87f2afcf6504" />


**KeyControl** is a Zero Trust API Gateway and management suite built to safeguard your API Keys while facilitating granular access control. It allows devs to take a single, sensitive "Secret" API key and transform it into multiple of "Virtual" keys (with limited permissions). By acting as a proxy, KeyControl makes sure your master credentials remain hidden while you distribute restricted, monitored, and revocable access to your clients or internal teams.

### The Virtual Key Advantage: A Use Case
Imagine you have a master OpenAI or Stripe key with full administrative permissions. You need to give a junior developer access to test a specific integration, and a third-party partner access to pull read-only reports. 
(Stripe has granual controls, but you get the point.)

Instead of handing over your master key, you use **KeyControl** to generate two distinct Virtual Keys. You set the developer's key to expire in 48 hours and restrict it to specific test endpoints. For the partner, you create a key that only allows `GET` requests and is locked to their specific office IP address. If either key is compromised, you revoke it in one click without ever needing to rotate your actual master secret.

### Virtual Key Capabilities
Every Virtual Key in KeyControl is also a programmable security policy. You can attach the following constraints to any key:

- **Rate Limiting:** Define multi-window thresholds (e.g., 5 requests per second and 500 per day) to prevent service abuse.
- **IP Security:** Enforce strict **Whitelists** to allow only trusted traffic or **Blacklists** to block known malicious actors.
- **Method Restrictions:** Control exactly which HTTP verbs (GET, POST, PUT, DELETE) a key can execute.
- **Endpoint Groups:** Bind keys to specific URL patterns (e.g., `/api/v1/public/*`) so they can only access authorized segments of your API.
- **Key Rotation:** Seamlessly update the underlying "Secret" key without changing the "Virtual" key your clients use, ensuring zero downtime during security updates.
- **Expiration Policies:** Set hard TTL (Time-to-Live) dates or usage-based limits that automatically deactivate the key.
- **Custom Error Handling:** Define exactly what a user sees (JSON, XML, or Plain Text) when they hit a rate limit or a blocked IP.

<img width="777" height="559" alt="image" src="https://github.com/user-attachments/assets/37a9e163-a961-4b9b-85a7-1ad38cfcd26b" />

### Advanced Access Management
KeyControl organizes complex permissions through a hierarchical system that keeps your gateway organized:

- **Logical Grouping:** Group your API paths into sets like "Public Analytics" or "Admin Write Operations" using wildcard patterns for easy management.
- **User Mapping:** Assign Virtual Keys to specific Users or Organizations to track consumption and logs on a per-client basis for auditing or billing.
- **Group Inheritance:** Map Virtual Keys to one or more Endpoint Groups to maintain a "Zero Trust" layer between the client and your infrastructure.

***

### How KeyControl Compares with alternatives 

| Feature                  | KeyControl  | AWS Secrets Mgr    | HashiCorp Vault   | Kong Gateway | Tyk (Open Source) |
| ------------------------ | ----------- | ------------------ | ----------------- | ------------ | ----------------- |
| Fully Open Source        | ✅           | ❌                  | ❌ (BSL/Paid)      | ✅            | ✅                 |
| Setup Time               | < 5 Minutes | Moderate (IAM/VPC) | High (Complexity) | Moderate     | Moderate          |
| Learning Curve           | Very Low    | Moderate           | Very High         | High         | Moderate          |
| Virtual Key Proxying     | ✅           | ❌                  | ❌                 | ❌            | ❌                 |
| Granular Endpoints       | ✅           | ❌                  | ❌                 | ✅            | ✅                 |
| Auto Key Expiration      | ✅           | ❌                  | ✅ (TTL-based)     | ❌ (Manual)   | ✅                 |
| Zero-Downtime Rotation   | ✅           | ✅ (Via Lambda)     | ✅                 | ❌ (Manual)   | ❌ (Manual)        |
| Multi-User Mapping       | ✅           | ❌                  | ❌                 | ✅ (Plugins)  | ❌ (Paid tier)     |
| IP Whitelists/Blacklists | ✅           | ✅ (Via WAF)        | ❌                 | ✅            | ✅                 |
| Unified GUI (Free)       | ✅           | ✅                  | ✅                 | ❌            | ❌ CLI Only, (I was surprised too)                 |

***
# Dashboard Demo 

## APIs Page  
<img width="1908" height="1079" alt="0" src="https://github.com/user-attachments/assets/05f962a2-cb7b-4839-b588-cdd52f80440e" />

<img width="1908" height="1079" alt="0" src="https://github.com/user-attachments/assets/05f962a2-cb7b-4839-b588-cdd52f80440e" />

When adding an API  
<img width="1906" height="1078" alt="1" src="https://github.com/user-attachments/assets/f53512c5-0dd8-4986-82dc-a7ee29ca4162" />


## Manage API Page
<img width="1910" height="1068" alt="2" src="https://github.com/user-attachments/assets/5ad9635a-9a04-4602-854b-092fbcf14806" />


When creating an Endpoint Group   
<img width="1919" height="1073" alt="3" src="https://github.com/user-attachments/assets/c2d6c483-a782-45c2-8d73-1c9886dc3e64" />

When adding an endpoint (or wildcard endpoints) to an Endpoint group

<img width="1919" height="1079" alt="4" src="https://github.com/user-attachments/assets/4885c6df-37cc-42fc-b3cb-a2d363bfe425" />

When adding another endpoint (or wildcard endpoints) to an Endpoint group

<img width="1907" height="1073" alt="5" src="https://github.com/user-attachments/assets/178ab0d3-45ed-4567-aca4-cd3940db0cca" />


When creating a Virtual API key for an API   

<img width="1915" height="1070" alt="6" src="https://github.com/user-attachments/assets/b9d8c3d5-9d66-492f-8a6c-51b596d1bbca" />


When creating a Virtual API key for an API (Part 2\)

<img width="1895" height="1076" alt="7" src="https://github.com/user-attachments/assets/542cdc03-2a96-49c8-b5db-a1e689ac82d5" />

## Blocklist Page

<img width="1919" height="1082" alt="8" src="https://github.com/user-attachments/assets/2c92e837-eab5-4730-ba77-8602375049a6" />

## Allowlist Page

<img width="1910" height="1076" alt="9" src="https://github.com/user-attachments/assets/f8691a00-dc1f-4d97-ae73-48d8f15859eb" />

## Ratelimit Page
<img width="1910" height="1082" alt="11" src="https://github.com/user-attachments/assets/a9f7a3b8-1dcf-4995-9788-abba54b908aa" />
<img width="1919" height="1079" alt="10" src="https://github.com/user-attachments/assets/f31de232-7300-41a5-be4f-b330e8b6ca3e" />



## Logs Page
<img width="1898" height="1073" alt="12" src="https://github.com/user-attachments/assets/b6c3df04-9227-4b6e-b1b5-f32da9d5bfa8" />


## Settings Page
<img width="1906" height="1078" alt="14" src="https://github.com/user-attachments/assets/169e15f8-e299-4d8c-82d5-db56ffaeb990" />
<img width="1895" height="1084" alt="13" src="https://github.com/user-attachments/assets/d9c96321-9508-4996-84f2-536da8135320" />



# 63 Major Platforms with Single Master API Keys – Detailed Risk Analysis

| Name | Description | Low-Permission Use Case | Risky Capability (Same Token) |
|------|-------------|------------------------|------------------------------|
| **Bunny.net (Storage)** | CDN and file storage | Developer wants to upload user-generated images to a storage zone | Same storage password allows DELETE of all files; purge entire storage zone billing cost history |
| **OpenAI (Legacy)** | AI model API | Engineer needs to call GPT-4 API for chat responses | Same account key can view organization billing, create new org members, access all shared fine-tuning models |
| **Anthropic (Claude)** | Generative AI platform | App calls Claude API to generate text summaries | Single key grants access to view usage statistics and billing data |
| **Mailchimp** | Email marketing | Marketer sends campaign to one audience list | Token inherits user role; can create admin accounts, access all customer lists, delete unsubscribe data, modify billing |
| **Twilio (Auth Token)** | SMS and telephony | Startup sends SMS verification codes to users | Same Auth Token can access all customer phone numbers in logs, trigger calls to numbers, modify rates, access historical call recordings |
| **Pusher** | Real-time messaging | App broadcasts chat notifications to clients | App Secret key can view all private channel data, trigger fake events impersonating other users |
| **Algolia (Admin Key)** | Search platform | Developer indexes product catalog | Admin key can delete all indices permanently, modify ranking rules, access analytics for competitor crawls |
| **DigitalOcean (PAT)** | Cloud infrastructure | Engineer deploys a web server droplet | Token allows destroying all droplets, accessing firewall rules, viewing all database backups, modifying billing |
| **Resend** | Email delivery | SaaS sends transactional emails | API key sends from any verified domain on account; attacker can send phishing emails from company domain |
| **Linode (PAT)** | Cloud hosting | DevOps creates a Kubernetes cluster | Token permits deleting all Kubernetes clusters, accessing all node IP addresses, modifying DNS zones |
| **GitHub (Classic PAT)** | Version control | CI/CD pushes to one public repo | Token grants access to all private repos user can see, delete repos, modify GitHub Actions secrets |
| **Adobe Sensei** | AI/ML services | ML engineer trains a model on one project | Key can access production datasets across all projects, modify model parameters for unrelated services |
| **SendGrid (Full Key)** | Email delivery | Marketing sends bulk campaigns | Full access key sends unrestricted emails from any domain, modifies sender IPs, accesses all unsubscribe data |
| **Square (PAT)** | Payment platform | Merchant checks sales transaction | Token provides full access to customers, orders, refund history, and PCI payment details |
| **Intercom** | Support platform | Support agent views customer ticket | Token grants access to view all customer conversations, modify pricing plans, access unencrypted message data |
| **Datadog (API Key)** | Monitoring/observability | Alert system sends test log | API key allows ingesting unlimited logs, accessing all dashboards and graphs, viewing sensitive infrastructure data |
| **Firebase (Service Account)** | Backend/database | App reads from Firestore collection | Service account key with "Editor" role can delete all databases, modify security rules, export user data |
| **HubSpot (Dev Key)** | CRM platform | Marketing automates contact updates | Legacy key grants access to modify deals, delete customer records, change pricing, access all deal values |
| **Shopify (Admin Token)** | E-commerce | App checks product inventory | Admin token reads all customer orders, access payment methods, modify product prices across store |
| **Notion** | Workspace platform | Integration reads one page | Integration token can read/write all connected pages; no per-page restrictions |
| **Google Cloud (Service Account)** | Cloud infrastructure | App reads Cloud Storage bucket | Service account key inherits broad IAM roles; can delete entire Cloud SQL databases, access Compute Engine instances |
| **Netlify (PAT)** | Jamstack hosting | Developer deploys a static site | Token allows deleting all sites, accessing all deployment logs with sensitive env vars exposed |
| **Vercel (Team Token)** | Serverless hosting | Engineer checks deployment status | Team token can redeploy all projects, access all environment variables, modify domain redirects |
| **Airtable (Legacy Key)** | No-code database | Analyst reads one table | Legacy key grants access to all bases, can delete tables, modify formulas, access hidden records |
| **PagerDuty (General Token)** | Incident management | On-call engineer acknowledges alert | General token accesses all incident data, modifies escalation policies, triggers false incidents |
| **Loom** | Video sharing | Editor embeds one Loom video | API key grants access to all workspace videos, can delete recording libraries, modify access |
| **Figma (PAT)** | Design tool | Developer exports one design file | Token grants access to all files in account, can delete shared team libraries, export proprietary designs |
| **Asana (PAT)** | Project management | PM assigns task in one project | Token allows viewing all team tasks, deleting projects, modifying user permissions across workspace |
| **Monday.com** | Work OS | Team lead checks board status | Token grants access to all boards, can delete items, modify team permissions, view hidden columns |
| **Jira (Legacy)** | Issue tracking | Engineer views bug ticket | Legacy token provides full project admin, can delete issues, modify permissions, export backlog |
| **Confluence (Legacy)** | Knowledge management | Employee reads wiki page | Legacy token can delete all pages, modify access permissions, export sensitive documentation |
| **Linear** | Issue tracking | Developer opens bug report | API key grants full workspace access, can delete all issues, modify billing, create admin accounts |
| **Zapier (Legacy)** | Automation platform | User triggers one automation | Legacy credentials expose master access to all Zaps, can modify triggers, view webhook payloads |
| **Make (Integromat)** | Low-code automation | User runs one workflow | Token grants access to all scenarios, can read execution history with sensitive data, delete flows |
| **Supabase (Service Key)** | Firebase alternative | App inserts row in Postgres table | Service key bypasses Row Level Security (RLS); can read all rows across all tables without permission checks |
| **Elasticsearch (Cluster)** | Search engine | App queries index for results | Cluster-level key can delete all indices, view all indexed data, modify cluster settings |
| **MongoDB Atlas (Org Key)** | Cloud database | Engineer connects to one project | Org-level key accesses all projects, can delete databases, modify billing, access snapshots |
| **Okta (SSWS Token)** | Identity management | Admin lists users in one group | Token grants broad permissions across all apps and users, can create shadow admin accounts |
| **Auth0 (Management API)** | Auth-as-a-service | Dev reads user email from rule | Token provides full access to all users, applications, can reset credentials, export user data |
| **Twitch (Legacy OAuth)** | Live streaming | Creator checks stream status | Legacy token granted access to moderation logs, ban user lists, can revoke stream key |
| **Zendesk** | Customer service | Agent views one support ticket | Token inherits full user role; can delete tickets, modify SLA policies, export customer data |
| **Calendly** | Scheduling | User checks availability calendar | Key grants access to all calendars, can delete events, modify availability, view attendee details |
| **Adobe Experience Manager** | Content management | Editor publishes one article | Token grants broad permissions, can delete entire content trees, modify asset permissions |
| **Salesforce (Legacy)** | CRM | Sales rep views one contact | Session token provides full org access, can delete records, modify workflows, access all reports |
| **Heroku (API Token)** | App hosting | Developer deploys app build | Token grants full account access; can destroy all apps, drain all dynos, cancel subscriptions |
| **Cloudinary** | Image/Video management | App uploads profile photo | API Secret allows full management; can delete image libraries, modify optimization settings, access billing |
| **Imgix** | Image processing | Website loads optimized image | Management key can delete all image sources, modify optimization rules, access billing history |
| **Loggly** | Log management | Eng views application logs | API token grants access to all logs without source filtering; can export sensitive data |
| **New Relic** | Observability | Engineer checks performance metrics | Admin API key grants access to all accounts and settings; can delete dashboards, modify alerts |
| **Postmark** | Transactional email | App sends password reset | Account-level key can modify servers, access bounce lists, send from unauthorized domains |
| **ShipStation** | Shipping software | Employee prints shipping label | API key grants access to all orders, customers, shipping labels; can modify rates |
| **ClickUp** | Productivity | Team member views task list | PAT grants access to all workspaces; can delete all tasks, modify team permissions |
| **Trello** | Kanban boards | Team views one board | API key grants access to all boards member can see; can delete cards, modify descriptions |
| **Mixpanel** | Product analytics | Engineer checks event count | Service account with broad access; can delete event data, modify funnels, export user lists |
| **Segment** | Customer data platform | Data team syncs one source | Workspace token grants access to all sources and destinations; can delete customer data pipelines |
| **Amplitude** | Behavioral analytics | PM checks retention metrics | API key grants project-wide data access; can delete cohorts, export user IDs, modify funnels |
| **LaunchDarkly** | Feature flagging | Dev enables flag for 10% users | Access token grants broad control; can flip all flags globally, delete experiments, access audit logs |
| **FullStory** | Session replay | Support agent watches one session | API key allows access to all user sessions including sensitive data (passwords, payment cards) |
| **Sentry (Org Token)** | Error tracking | Dev checks error from alert | Org-wide token grants access to all projects; can delete sensitive issues, modify alerting rules |
| **CircleCI (PAT)** | CI/CD | Engineer triggers pipeline build | Token grants access to all projects; can read environment variables, view secrets, trigger builds |
| **Travis CI (Token)** | CI/CD | DevOps checks build status | Token allows triggering builds on all repos, viewing encrypted secrets in logs |
| **Bitly** | URL shortener | Marketing checks link clicks | Generic access token grants access to all links; can delete/modify shortened URLs, access analytics |
| **Buffer** | Social media mgmt | Manager schedules one post | API token grants access to all social profiles; can delete posts, modify accounts, view analytics |
