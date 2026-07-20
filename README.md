# Kizuna Club Portal v3.0 - Production

Production-ready Kizuna Club portal with Supabase authentication.

## Admin Emails (Pre-configured)
- mike@av.vc
- mgp@av.vc
- yoshihisa.yamada@av.vc
- ryan.nakata@av.vc

## Supabase Already Configured
- URL: https://xjywtykkrvsbjfiuzglc.supabase.co
- Database schema already loaded ✓
- Credentials embedded in app.jsx ✓

## Deploy Steps

### Step 1: Configure Auth Redirect
1. Go to Supabase → Authentication → URL Configuration
2. Add your Netlify URL to Redirect URLs

### Step 2: Push to GitHub
1. Replace your existing repo files with these
2. Commit and push:
   ```bash
   git add .
   git commit -m "Upgrade to Supabase auth v3"
   git push
   ```

### Step 3: Netlify Will Auto-Build
- Netlify runs: `npm install && npm run build`
- Deploys the `dist` folder

### Step 4: Test
1. Go to your Netlify URL
2. Enter: ryan.nakata@av.vc
3. Check email for magic link
4. Click → You're in as Admin!

## Files
| File | Purpose |
|------|---------|
| app.jsx | Main React application with Supabase auth |
| main.jsx | React entry point |
| index.html | HTML wrapper |
| package.json | Dependencies (includes @supabase/supabase-js) |
| netlify.toml | Build config |
