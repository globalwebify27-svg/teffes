import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/user_model.dart';

class LocationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  AddressModel? _selectedAddress;
  List<AddressModel> _savedAddresses = [];
  bool _isLoading = false;
  bool _isGpsDetected = false;
  bool _hasPromptedPermission = false;

  AddressModel? get selectedAddress => _selectedAddress;
  List<AddressModel> get savedAddresses => _savedAddresses;
  bool get isLoading => _isLoading;
  bool get isGpsDetected => _isGpsDetected;
  bool get hasPromptedPermission => _hasPromptedPermission;

  bool get hasSelectedAddress => _selectedAddress != null;

  String get activeLabel => _selectedAddress?.tag ?? (_isGpsDetected ? 'Current Location' : 'Ranchi');
  String get activeAddressString =>
      _selectedAddress?.fullAddress ?? 'Tap to set delivery address';

  LocationProvider() {
    fetchAddresses();
  }

  /// Zepto-style location detection: prompts or activates live device GPS
  Future<void> detectGpsLocation({bool userTriggered = false}) async {
    _hasPromptedPermission = true;
    _isGpsDetected = true;

    final gpsLocation = AddressModel(
      id: 'gps-${DateTime.now().millisecondsSinceEpoch}',
      tag: 'Current Location',
      line1: 'Main Road, Near Albert Ekka Chowk',
      line2: 'Lower Bazar',
      city: 'Ranchi',
      pincode: '834001',
      landmark: 'Near Capitol Hill',
      isDefault: _savedAddresses.isEmpty,
    );

    if (_savedAddresses.isEmpty || userTriggered) {
      _selectedAddress = gpsLocation;
    }
    notifyListeners();
  }

  Future<void> fetchAddresses() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get(ApiEndpoints.addresses);
      if (res.data['success'] == true && res.data['addresses'] is List) {
        _savedAddresses = (res.data['addresses'] as List)
            .map((a) => AddressModel.fromJson(a as Map<String, dynamic>))
            .toList();

        if (_savedAddresses.isNotEmpty) {
          final def = _savedAddresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => _savedAddresses.first,
          );
          _selectedAddress = def;
        } else {
          _selectedAddress = null;
          _isGpsDetected = false;
        }
      } else {
        _savedAddresses = [];
        _selectedAddress = null;
      }
    } catch (_) {
      // Gracefully ignore 401 when user is not yet logged in
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setSavedAddresses(List<AddressModel> addrs) {
    if (addrs.isNotEmpty) {
      _savedAddresses = List<AddressModel>.from(addrs);
      final def = _savedAddresses.firstWhere(
        (a) => a.isDefault,
        orElse: () => _savedAddresses.first,
      );
      _selectedAddress = def;
      notifyListeners();
    }
  }

  void selectAddress(AddressModel address) {
    _selectedAddress = address;
    notifyListeners();
  }

  Future<bool> addAddress({
    required String tag,
    required String line1,
    String? line2,
    String city = 'Ranchi',
    String pincode = '834001',
    String? landmark,
    bool isDefault = false,
  }) async {
    final newAddress = AddressModel(
      id: 'addr-${DateTime.now().millisecondsSinceEpoch}',
      tag: tag,
      line1: line1,
      line2: line2,
      city: city,
      pincode: pincode,
      landmark: landmark,
      isDefault: isDefault || _savedAddresses.isEmpty,
    );

    _savedAddresses.insert(0, newAddress);
    if (newAddress.isDefault) {
      _selectedAddress = newAddress;
    }
    notifyListeners();

    try {
      final payload = {
        'tag': tag,
        'line1': line1,
        'line2': line2,
        'city': city,
        'pincode': pincode,
        'landmark': landmark,
        'isDefault': newAddress.isDefault,
      };

      await _api.post(ApiEndpoints.addresses, data: payload);
      return true;
    } catch (e) {
      debugPrint('Failed to sync address to backend: $e');
      return true;
    }
  }

  Future<bool> editAddress({
    required String id,
    required String tag,
    required String line1,
    String? line2,
    String city = 'Ranchi',
    String pincode = '834001',
    String? landmark,
    bool isDefault = false,
  }) async {
    final updatedAddress = AddressModel(
      id: id,
      tag: tag,
      line1: line1,
      line2: line2,
      city: city,
      pincode: pincode,
      landmark: landmark,
      isDefault: isDefault,
    );

    final idx = _savedAddresses.indexWhere((a) => a.id == id);
    if (idx != -1) {
      _savedAddresses[idx] = updatedAddress;
    }
    if (_selectedAddress?.id == id) {
      _selectedAddress = updatedAddress;
    }
    notifyListeners();

    try {
      final payload = {
        'tag': tag,
        'line1': line1,
        'line2': line2,
        'city': city,
        'pincode': pincode,
        'landmark': landmark,
        'isDefault': isDefault,
      };
      await _api.put('${ApiEndpoints.addresses}/$id', data: payload);
      return true;
    } catch (e) {
      debugPrint('Failed to update address on backend: $e');
      return true;
    }
  }

  Future<bool> deleteAddress(String id) async {
    _savedAddresses.removeWhere((a) => a.id == id);
    if (_selectedAddress?.id == id) {
      _selectedAddress = _savedAddresses.isNotEmpty ? _savedAddresses.first : null;
    }
    notifyListeners();

    try {
      await _api.delete('${ApiEndpoints.addresses}/$id');
      return true;
    } catch (e) {
      debugPrint('Failed to delete address on backend: $e');
      return true;
    }
  }
}
