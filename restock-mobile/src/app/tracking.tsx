import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';
const { width, height } = Dimensions.get('window');

// Free OpenStreetMap tile server
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron.json';

export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [riderLocation, setRiderLocation] = useState(null);
  const [isRider, setIsRider] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const mapRef = useRef(null);

  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
      checkUserRole();
    }
    requestLocationPermission();
  }, [orderId]);

  const checkUserRole = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setIsRider(user.role === 'rider');
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // If rider, start tracking their movement
        if (isRider) {
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (newLocation) => {
              const loc = {
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              };
              setRiderLocation(loc);
              // Update rider position on map
              if (mapRef.current) {
                mapRef.current.setCamera({
                  centerCoordinate: [loc.longitude, loc.latitude],
                  zoomLevel: 15,
                });
              }
            }
          );
        }
      } else {
        Alert.alert(
          'Location Permission',
          'Please enable location to track deliveries.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const loadOrder = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setOrder(data.order);
        
        // Set pickup location (from distributor)
        if (data.order.pickupAddress) {
          setPickup({
            latitude: data.order.pickupAddress.lat || 6.5244,
            longitude: data.order.pickupAddress.lng || 3.3792,
            title: data.order.pickupAddress.distributorName || 'Pickup',
          });
        }
        
        // Set delivery destination (from shop)
        if (data.order.deliveryAddress) {
          setDestination({
            latitude: data.order.deliveryAddress.lat || 6.5244,
            longitude: data.order.deliveryAddress.lng || 3.3792,
            title: data.order.deliveryAddress.shopName || 'Delivery',
          });
        }
      }
    } catch (error) {
      console.error('Error loading order:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#01311F" />
        <Text style={styles.loadingText}>Loading tracking...</Text>
      </SafeAreaView>
    );
  }

  // Define center of map
  const centerCoordinate = riderLocation 
    ? [riderLocation.longitude, riderLocation.latitude]
    : destination 
    ? [destination.longitude, destination.latitude]
    : [3.3792, 6.5244];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRider ? '📍 Live Location' : '📦 Track Order'}
        </Text>
        <Text style={styles.headerOrder}>
          #{orderId?.slice(-6).toUpperCase()}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapLibreGL.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={MAP_STYLE}
          zoomEnabled={true}
          pitchEnabled={true}
          scrollEnabled={true}
          compassEnabled={true}
        >
          {/* Show user's location (rider or customer) */}
          {userLocation && (
            <MapLibreGL.PointAnnotation
              id="user-location"
              coordinate={[userLocation.longitude, userLocation.latitude]}
            >
              <View style={styles.userMarker}>
                <View style={styles.userMarkerInner} />
              </View>
            </MapLibreGL.PointAnnotation>
          )}

          {/* Show pickup location */}
          {pickup && (
            <MapLibreGL.PointAnnotation
              id="pickup-location"
              coordinate={[pickup.longitude, pickup.latitude]}
            >
              <View style={styles.pickupMarker}>
                <Text style={styles.markerText}>📦</Text>
              </View>
            </MapLibreGL.PointAnnotation>
          )}

          {/* Show delivery destination */}
          {destination && (
            <MapLibreGL.PointAnnotation
              id="destination-location"
              coordinate={[destination.longitude, destination.latitude]}
            >
              <View style={styles.destinationMarker}>
                <Text style={styles.markerText}>🏪</Text>
              </View>
            </MapLibreGL.PointAnnotation>
          )}

          {/* Show rider's live location (if rider is moving) */}
          {isRider && riderLocation && (
            <MapLibreGL.PointAnnotation
              id="rider-location"
              coordinate={[riderLocation.longitude, riderLocation.latitude]}
            >
              <View style={styles.riderMarker}>
                <Text style={styles.markerText}>🏍️</Text>
              </View>
            </MapLibreGL.PointAnnotation>
          )}
        </MapLibreGL.MapView>

        {/* Info Overlay */}
        <View style={styles.infoOverlay}>
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              📊 Status: {order?.status?.toUpperCase() || 'PENDING'}
            </Text>
            {isRider && (
              <Text style={styles.sharingText}>🟢 Sharing location</Text>
            )}
          </View>
          
          <View style={styles.addressCard}>
            {pickup && (
              <Text style={styles.addressText}>
                📥 Pickup: {pickup.title}
              </Text>
            )}
            {destination && (
              <Text style={styles.addressText}>
                📍 Delivery: {destination.title}
              </Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6C757D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#01311F',
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerOrder: {
    color: '#4DBE18',
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4DBE18',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#01311F',
  },
  pickupMarker: {
    backgroundColor: '#FDCB6E',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  destinationMarker: {
    backgroundColor: '#E17055',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  riderMarker: {
    backgroundColor: '#01311F',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#4DBE18',
  },
  markerText: {
    fontSize: 18,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#01311F',
  },
  sharingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4DBE18',
  },
  addressCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 12,
  },
  addressText: {
    fontSize: 13,
    color: '#495057',
    marginBottom: 4,
  },
});