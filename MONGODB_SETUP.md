# MongoDB Atlas Setup Guide

## ✅ Good News!

Your authentication system is already configured to use MongoDB! All you need to do is:

1. Set up MongoDB Atlas (FREE)
2. Add the connection string to `.env.local`
3. Test the APIs

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create MongoDB Atlas Account

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up with Google/GitHub (easiest)
3. Choose **FREE** tier (M0 Sandbox)

### Step 2: Create a Cluster

1. After signup, click "Build a Database"
2. Choose **FREE** (M0) tier
3. Select a cloud provider (AWS recommended)
4. Choose a region close to you
5. Click "Create Cluster" (takes 1-3 minutes)

### Step 3: Create Database User

1. Click "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `financeai`
5. Password: Click "Autogenerate Secure Password" and **COPY IT**
6. Database User Privileges: "Atlas admin"
7. Click "Add User"

### Step 4: Allow Network Access

1. Click "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)
4. Click "Confirm"

### Step 5: Get Connection String

1. Click "Database" in left sidebar
2. Click "Connect" button on your cluster
3. Choose "Connect your application"
4. Driver: Node.js
5. Version: 5.5 or later
6. **COPY** the connection string
7. It looks like: `mongodb+srv://financeai:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### Step 6: Add to .env.local

1. Open `.env.local` file
2. Replace `<password>` in the connection string with your actual password
3. Add this line:

```env
MONGODB_URI=mongodb+srv://financeai:YOUR_PASSWORD_HERE@cluster0.xxxxx.mongodb.net/financeai?retryWrites=true&w=majority
```

**Important**:

- Replace `YOUR_PASSWORD_HERE` with the password you copied
- Add `/financeai` before the `?` to specify the database name

### Step 7: Restart Dev Server

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

---

## 🧪 Test Everything

### Option 1: Use the Test Page

1. Go to: http://localhost:3000/api-test
2. You should see the test dashboard
3. Try creating a portfolio!

### Option 2: Sign In First

1. Go to: http://localhost:3000
2. Sign in with Google/GitHub
3. Then go to: http://localhost:3000/api-test

---

## ✅ What Will Be Created in MongoDB

Once you start using the app, MongoDB will automatically create these collections:

- **users** - User accounts (from NextAuth)
- **portfolios** - Your portfolio data
- **watchlists** - Your watchlist data
- **sessions** - NextAuth sessions
- **accounts** - OAuth account links

---

## 🐛 Troubleshooting

### Error: "MONGODB_URI is not defined"

**Solution**: Make sure you added `MONGODB_URI` to `.env.local` and restarted the dev server

### Error: "Authentication failed"

**Solution**: Check that you replaced `<password>` with your actual password in the connection string

### Error: "IP not whitelisted"

**Solution**: Go to Network Access and add "0.0.0.0/0" (allow from anywhere)

### Error: "User not authorized"

**Solution**: Make sure your database user has "Atlas admin" privileges

---

## 📝 Example .env.local

Your `.env.local` should look like this:

```env
# MongoDB
MONGODB_URI=mongodb+srv://financeai:MySecurePassword123@cluster0.abc123.mongodb.net/financeai?retryWrites=true&w=majority

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_ID=your-github-id
GITHUB_SECRET=your-github-secret

# APIs
NEXT_PUBLIC_NEWSAPI_KEY=your-newsapi-key
TWELVE_DATA_API_KEY=your-twelvedata-key
# ... other API keys
```

---

## ✨ Next Steps

Once MongoDB is connected:

1. ✅ Sign in to your app
2. ✅ Go to http://localhost:3000/api-test
3. ✅ Test creating portfolios and watchlists
4. ✅ Verify data appears in MongoDB Atlas (Database → Browse Collections)
5. ✅ Commit Phase 1 changes
6. ✅ Move to Phase 2 (Portfolio UI)

---

## 💡 Pro Tip

You can view your data in MongoDB Atlas:

1. Go to "Database" → "Browse Collections"
2. Select your database (`financeai`)
3. See all your collections and data!

Ready to set up MongoDB? It only takes 5 minutes! 🚀
