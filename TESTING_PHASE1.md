# Phase 1 API Testing - Quick Start

## 🚀 Test Your APIs in the Browser!

I've created a simple test page where you can test all the API endpoints.

### Access the Test Page

1. Make sure your dev server is running:

   ```bash
   npm run dev
   ```

2. Open your browser and go to:

   ```
   http://localhost:3000/api-test
   ```

3. **Important**: You must be logged in! If not logged in, go to http://localhost:3000 and sign in first.

---

## 📋 Testing Steps

### Test Portfolio APIs

1. **Create Portfolio**

   - Enter a portfolio name
   - Click "Create Portfolio"
   - Copy the `_id` from the response

2. **List Portfolios**

   - Click "Get All Portfolios"
   - Verify your portfolio appears

3. **Add Holding**

   - Paste the portfolio ID
   - Enter stock symbol (e.g., AAPL)
   - Enter quantity and price
   - Click "Add Holding"

4. **Get Portfolio Details**

   - Paste portfolio ID
   - Click "Get Portfolio"
   - Verify holdings are shown

5. **Delete Portfolio**
   - Paste portfolio ID
   - Click "Delete Portfolio"

### Test Watchlist APIs

1. **Create Watchlist**

   - Enter watchlist name
   - Click "Create Watchlist"
   - Copy the `_id`

2. **List Watchlists**

   - Click "Get All Watchlists"

3. **Add Asset**

   - Paste watchlist ID
   - Enter symbol
   - Click "Add Asset"

4. **Delete Watchlist**
   - Paste watchlist ID
   - Click "Delete Watchlist"

---

## ✅ What to Verify

- [ ] Can create portfolio (status 201)
- [ ] Can list portfolios (status 200)
- [ ] Can add holdings (status 201)
- [ ] Can get portfolio details (status 200)
- [ ] Can delete portfolio (status 200)
- [ ] Can create watchlist (status 201)
- [ ] Can list watchlists (status 200)
- [ ] Can add assets (status 200)
- [ ] Can delete watchlist (status 200)
- [ ] Get 401 error when not logged in
- [ ] Get 400 error for invalid data

---

## 🐛 Troubleshooting

### "Unauthorized" Error (401)

**Solution**: Make sure you're logged in at http://localhost:3000

### MongoDB Connection Error

**Solution**: Add `MONGODB_URI` to your `.env.local` file

### "Portfolio not found" (404)

**Solution**: Make sure you're using the correct ID from the create response

---

## 🎯 Next Steps

Once all tests pass:

1. Commit Phase 1 changes
2. Move to Phase 2 (Portfolio UI)

Happy testing! 🧪
