# Quick Setup & Testing Checklist

Complete these steps to get your database up and running:

## ✅ Phase 1: Environment Setup (5 mins)

- [ ] Create Supabase project at https://supabase.com
- [ ] Go to Supabase Settings > API and copy your credentials
- [ ] Create `.env.local` file in project root
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`
- [ ] Run `npm install` to install all dependencies including Supabase client

## ✅ Phase 2: Database Schema (5 mins)

- [ ] Open Supabase Dashboard > SQL Editor
- [ ] Create a new query
- [ ] Copy entire contents of `supabase_schema.sql`
- [ ] Paste into SQL Editor and click **Run**
- [ ] Wait for completion (should show "success")
- [ ] Verify tables exist in Supabase > Table Editor (should see all 10 tables)

## ✅ Phase 3: Verify Credentials (2 mins)

- [ ] In terminal, run `npm run dev`
- [ ] Check browser console (F12) for any Supabase connection errors
- [ ] If you see errors like "Missing Supabase URL", update `.env.local`
- [ ] Stop dev server (Ctrl+C) and restart after fixing

## ✅ Phase 4: Test Database Integration (10 mins)

### Option A: Using Test Component (Recommended for beginners)

1. Import the test component in `App.tsx`:
   ```typescript
   import DatabaseTestComponent from './components/DatabaseTestComponent';
   ```

2. Add it to your render (temporary):
   ```typescript
   <DatabaseTestComponent />
   ```

3. Run `npm run dev` and test all buttons:
   - [ ] Click "Test Barcode Scan" - should show "Maize Meal 10kg"
   - [ ] Click "Create Test Product" - should show success
   - [ ] Click "Get Daily Summary" - should show sales data
   - [ ] Check console for detailed logs

### Option B: Manual Testing via Browser

1. Open DevTools Console (F12)
2. Run these commands one by one:

```javascript
// Import services (you may need to adjust path)
import { useProducts } from './services'

// Test connection
const { products } = useProducts()
console.log('Products:', products)

// Check sample data loaded
console.log('First product:', products[0])
```

## ✅ Phase 5: Common Issues & Solutions

### Issue: "Cannot find module '@supabase/supabase-js'"
**Solution:** Run `npm install` again, then restart dev server

### Issue: "Missing Supabase URL or Anon Key"
**Solution:** 
- Check `.env.local` exists and has correct format
- Verify keys from Supabase dashboard
- Restart dev server after updating `.env.local`

### Issue: "Auth method POST denied"
**Solution:** 
- Check Supabase project is in "free" or active tier
- Go to Supabase > Authentication > Policies
- Verify RLS policies are set to allow read access

### Issue: "No data showing in app"
**Solution:** 
- Check browser console for errors (F12)
- Verify tables exist in Supabase (Table Editor)
- Run the schema SQL again if tables are missing
- Check network tab to see API responses

## ✅ Phase 6: Integration Steps (Optional - for developers)

After verification, replace hardcoded data in App.tsx:

```typescript
// Replace this:
const [products, setProducts] = useState(initialProducts);

// With this:
const { products } = useProducts();
```

Do the same for sales, debtors, etc.

## ✅ Phase 7: Production Checklist

Before deploying:

- [ ] Test all main features work with real database
- [ ] Set up proper RLS policies in Supabase
- [ ] Enable backups in Supabase > Settings > Backups
- [ ] Set up Supabase Auth for user login (optional but recommended)
- [ ] Enable real-time subscriptions if needed
- [ ] Test on different devices/networks

## 📊 Success Indicators

You'll know everything is working when:

1. ✅ No console errors on page load
2. ✅ Products load from database (not hardcoded)
3. ✅ Can scan barcode and find products
4. ✅ Can complete a sale and see it in database
5. ✅ Can add debtors and track payments
6. ✅ Sales appear in reports/analytics

## 🎯 Next Steps

Once database is working:

1. **User Authentication** - Add Supabase Auth for login
2. **Real-time Updates** - Enable live subscriptions
3. **Mobile App** - Create React Native version
4. **Advanced Analytics** - Add charts and reports
5. **Offline Mode** - Sync when reconnected

## 📞 Support

- Supabase Docs: https://supabase.com/docs
- React Hooks Guide: See SUPABASE_SETUP.md
- Check browser console for detailed error messages
- Database logs available in Supabase Dashboard

---

**⏱️ Total Setup Time: ~30 minutes**

**Good luck! 🚀**
