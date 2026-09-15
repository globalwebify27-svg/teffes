import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/banner_model.dart';
import '../models/category_model.dart';
import '../models/coupon_model.dart';
import '../models/product_model.dart';

class ProductsProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<CategoryModel> _categories = [];
  List<ProductModel> _products = [];
  List<BannerModel> _banners = [];
  CouponModel? _superOffer;
  bool _isLoading = false;
  String? _error;

  String _selectedCategory = 'chicken';
  String _selectedSubcategory = 'All';
  String _searchQuery = '';

  List<CategoryModel> get categories => _categories;
  List<ProductModel> get products => _products;
  List<BannerModel> get banners => _banners;
  CouponModel? get superOffer => _superOffer;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get selectedCategory => _selectedCategory;
  String get selectedSubcategory => _selectedSubcategory;
  String get searchQuery => _searchQuery;

  ProductsProvider() {
    _initDefaultCategories();
    _initDefaultBanners();
    _initDefaultSuperOffer();
    fetchCatalog();
    fetchBanners();
    fetchSuperOffer();
  }

  void _initDefaultCategories() {
    _categories = [
      CategoryModel(
        key: 'chicken',
        label: 'Fresh Chicken',
        image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
        subtitle: 'Farm fresh, 100% antibiotic-free',
        itemCount: 12,
        subcategories: ['All', 'Boneless & Keema', 'Curry Cut', 'Biryani Cut', 'Desi Chicken', 'Specialty'],
      ),
      CategoryModel(
        key: 'mutton',
        label: 'Rich Mutton',
        image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=600&q=80',
        subtitle: 'Tender pasture-raised cuts',
        itemCount: 8,
        subcategories: ['All', 'Curry Cut', 'Boneless', 'Chops & Ribs'],
      ),
      CategoryModel(
        key: 'fish-seafood',
        label: 'Fish & Seafood',
        image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
        subtitle: 'Fresh catch daily, chemical-free',
        itemCount: 18,
        subcategories: ['All', 'Freshwater Fish', 'Sea Prawns', 'Fillet Cuts'],
      ),
      CategoryModel(
        key: 'eggs',
        label: 'Farm Eggs',
        image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
        subtitle: 'Farm fresh brown & classic eggs',
        itemCount: 6,
        subcategories: ['All', 'Classic Brown', 'Country Free-Range'],
      ),
    ];
  }

  void _initDefaultBanners() {
    _banners = [
      BannerModel(
        id: 'default-1',
        title: 'Fresh • Hygienic • Farm-Raised Chicken',
        image: 'https://cdn.dotpe.in/longtail/themes/7524323/pLA8ptbh.webp',
        link: 'category:chicken',
        order: 1,
        isActive: true,
      ),
      BannerModel(
        id: 'default-2',
        title: "TeFFe's Farm Quality Meat • 90 Min Delivery",
        image: 'https://cdn.dotpe.in/longtail/themes/7524323/VRLhTQ4p.webp',
        link: 'all',
        order: 2,
        isActive: true,
      ),
    ];
  }

  void _initDefaultSuperOffer() {
    _superOffer = const CouponModel(
      id: 'default-super-offer',
      code: 'FIRST50',
      discount: '₹50 flat off on first order above ₹299',
      discountType: 'fixed',
      discountValue: 50.0,
      minOrder: 299.0,
      status: 'Active',
      validTill: '31 Dec 2026',
      isSuperOffer: true,
    );
  }

  Future<void> fetchSuperOffer() async {
    try {
      final res = await _api.get(ApiEndpoints.superOffer);
      if (res.data['success'] == true && res.data['superOffer'] != null) {
        _superOffer = CouponModel.fromJson(Map<String, dynamic>.from(res.data['superOffer'] as Map));
        notifyListeners();
      } else {
        _superOffer = null;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching super offer: $e');
    }
  }

  Future<void> fetchBanners() async {
    try {
      final res = await _api.get(ApiEndpoints.banners);
      if (res.data['success'] == true && res.data['banners'] is List) {
        final fetched = (res.data['banners'] as List)
            .map((b) => BannerModel.fromJson(Map<String, dynamic>.from(b as Map)))
            .where((b) => b.isActive && b.image.trim().isNotEmpty)
            .toList();

        if (fetched.isNotEmpty) {
          _banners = fetched;
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Error fetching hero banners: $e');
    }
  }

  Future<void> fetchCatalog() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // 1. Fetch Categories from Server dynamically
      try {
        final catRes = await _api.get(ApiEndpoints.categories);
        if (catRes.data['success'] == true && catRes.data['categories'] is List) {
          final serverList = (catRes.data['categories'] as List)
              .map((c) => CategoryModel.fromJson(c as Map<String, dynamic>))
              .where((c) => c.key.isNotEmpty)
              .toList();

          if (serverList.isNotEmpty) {
            final defaultMap = {for (final d in _categories) d.key: d};
            _categories = serverList.map((serverCat) {
              final defMatch = defaultMap[serverCat.key] ??
                  (serverCat.key == 'fish' ? defaultMap['fish-seafood'] : null);

              final img = serverCat.image.isNotEmpty &&
                      !serverCat.image.contains('undefined') &&
                      !serverCat.image.contains('photo-1544025162-d76694265947') &&
                      !serverCat.image.contains('photo-1603048588665-791ca8aea617')
                  ? serverCat.image
                  : (defMatch?.image ??
                      'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80');

              return CategoryModel(
                key: serverCat.key,
                label: serverCat.label,
                image: img,
                subtitle: serverCat.subtitle ?? defMatch?.subtitle ?? 'Fresh cuts daily',
                itemCount: defMatch?.itemCount ?? 8,
                subcategories: defMatch?.subcategories ?? ['All'],
              );
            }).toList();
          }
        }
      } catch (catErr) {
        debugPrint('Error fetching dynamic categories: $catErr');
      }

      // 2. Fetch All Products from Server (limit 100)
      final res = await _api.get('${ApiEndpoints.products}?limit=100&all=true');
      if (res.data['success'] == true && res.data['products'] is List) {
        final fetched = (res.data['products'] as List).map((raw) {
          final map = Map<String, dynamic>.from(raw as Map);
          final cat = (map['category'] ?? '').toString().toLowerCase();

          // Sanitize any cooked meat or CD player image to fresh raw mutton
          final img = (map['image'] ?? '').toString();
          if (img.contains('photo-1603048588665-791ca8aea617') || img.contains('photo-1544025162-d76694265947')) {
            map['image'] = 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=900&q=80';
          }

          // Normalize 'desi-chicken' as a product under 'chicken' with subCategory 'Desi Chicken'
          if (cat == 'desi-chicken' || cat == 'desi_chicken') {
            map['category'] = 'chicken';
            map['categoryLabel'] = 'Chicken';
            map['subCategory'] = 'Desi Chicken';
            map['badge'] = map['badge'] ?? 'Desi Country Chicken';
          } else if (cat == 'fish') {
            map['category'] = 'fish-seafood';
            map['categoryLabel'] = 'Fish & Seafood';
          }
          return ProductModel.fromJson(map);
        }).toList();

        if (fetched.isNotEmpty) {
          _products = fetched;
        }
      }
    } catch (e) {
      debugPrint('Error fetching products from server: $e');
      _error = 'Unable to connect to butchery catalog server';
    } finally {
      _isLoading = false;
      notifyListeners();
      fetchSuperOffer();
      fetchBanners();
    }
  }

  List<ProductModel> searchAllProducts(String query) {
    final clean = query.trim().toLowerCase();
    if (clean.isEmpty) return [];
    return _products.where((p) {
      return p.name.toLowerCase().contains(clean) ||
          p.category.toLowerCase().contains(clean) ||
          p.categoryLabel.toLowerCase().contains(clean) ||
          p.description.toLowerCase().contains(clean) ||
          (p.cutType ?? '').toLowerCase().contains(clean);
    }).toList();
  }

  void selectCategory(String categoryKey) {
    if (_selectedCategory != categoryKey) {
      _selectedCategory = categoryKey;
      _selectedSubcategory = 'All';
      notifyListeners();
    }
  }

  void selectSubcategory(String subcategory) {
    _selectedSubcategory = subcategory;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query.trim().toLowerCase();
    notifyListeners();
  }

  List<ProductModel> get filteredProducts {
    return _products.where((p) {
      // Category filter
      final pCat = p.category.toLowerCase();
      final selCat = _selectedCategory.toLowerCase();
      final matchesCat = selCat == 'all' ||
          pCat == selCat ||
          ((pCat == 'fish-seafood' || pCat == 'fish') && (selCat == 'fish-seafood' || selCat == 'fish'));
      if (!matchesCat) return false;

      // Search filter (if user typed in search bar)
      if (_searchQuery.isNotEmpty) {
        return p.name.toLowerCase().contains(_searchQuery) ||
            p.categoryLabel.toLowerCase().contains(_searchQuery) ||
            p.description.toLowerCase().contains(_searchQuery);
      }

      return true;
    }).toList();
  }

  List<ProductModel> get homeChickenCuts {
    final list = _products
        .where((p) => p.inStock && (p.category.toLowerCase() == 'chicken' || p.category.toLowerCase() == 'desi-chicken'))
        .take(4)
        .toList();
    if (list.length < 4) {
      final additional = _products
          .where((p) => (p.category.toLowerCase() == 'chicken' || p.category.toLowerCase() == 'desi-chicken') && !list.any((x) => x.id == p.id))
          .take(4 - list.length);
      list.addAll(additional);
    }
    return list;
  }

  List<ProductModel> get homeFishCuts {
    final list = _products
        .where((p) => p.inStock && (p.category.toLowerCase() == 'fish-seafood' || p.category.toLowerCase() == 'fish'))
        .take(2)
        .toList();
    if (list.length < 2) {
      final additional = _products
          .where((p) => (p.category.toLowerCase() == 'fish-seafood' || p.category.toLowerCase() == 'fish') && !list.any((x) => x.id == p.id))
          .take(2 - list.length);
      list.addAll(additional);
    }
    return list;
  }

  List<ProductModel> get homeMuttonCuts {
    final list = _products
        .where((p) => p.inStock && p.category.toLowerCase() == 'mutton')
        .take(2)
        .toList();
    if (list.length < 2) {
      final additional = _products
          .where((p) => p.category.toLowerCase() == 'mutton' && !list.any((x) => x.id == p.id))
          .take(2 - list.length);
      list.addAll(additional);
    }
    return list;
  }

  List<ProductModel> get freshButcheryCuts {
    // Exclude eggs strictly from Fresh Butchery Cuts
    final meatAndSeafood = _products
        .where((p) => p.inStock && p.category.toLowerCase() != 'eggs')
        .toList();

    // Curate a balanced mix of Chicken, Mutton, and Fish & Seafood cuts
    final chicken = meatAndSeafood.where((p) => p.category.toLowerCase() == 'chicken').take(2).toList();
    final mutton = meatAndSeafood.where((p) => p.category.toLowerCase() == 'mutton').take(2).toList();
    final fish = meatAndSeafood
        .where((p) => p.category.toLowerCase() == 'fish-seafood' || p.category.toLowerCase() == 'fish')
        .take(2)
        .toList();

    final curated = <ProductModel>[...chicken, ...mutton, ...fish];
    if (curated.isNotEmpty) {
      // Fill up to 6 if any category has fewer than 2 items
      for (final p in meatAndSeafood) {
        if (curated.length >= 6) break;
        if (!curated.any((c) => c.id == p.id)) {
          curated.add(p);
        }
      }
      return curated;
    }

    return meatAndSeafood.take(6).toList();
  }

  List<ProductModel> get farmFreshEggs {
    return _products.where((p) => p.inStock && p.category.toLowerCase() == 'eggs').toList();
  }

  ProductModel? findProductById(String id) {
    try {
      return _products.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }
}
