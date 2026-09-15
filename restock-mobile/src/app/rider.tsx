import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Location from 'expo-location';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

export default function RiderScreen() {
  const [user, setUser] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  // Delivery action state
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState('');

  // Settings state
  const [profile, setProfile] = useState({
    fullName: '',
    phone: '',
    email: '',
    vehicleType: 'motorcycle',
    vehiclePlate: '',
    city: '',
    state: '',
    radius: '10',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadUser();
    loadDeliveries();
    startLocationUpdates();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  // ============================================================
  // LOAD DELIVERIES
  // ============================================================
  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/orders?riderId=${currentUser?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDeliveries(data.orders || []);
        const total = data.orders.length;
        const pending = data.orders.filter(o => o.status === 'picked_up' || o.status === 'out_for_delivery').length;
        const completed = data.orders.filter(o => o.status === 'delivered').length;
        setStats({ total, pending, completed });
      }
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================
  // UPDATE LOCATION
  // ============================================================
  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/riders/${user?.id}/location`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.coords.latitude, lng: location.coords.longitude }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const startLocationUpdates = () => {
    const interval = setInterval(() => { if (user?.id) updateLocation(); }, 10000);
    return () => clearInterval(interval);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDeliveries();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'settings') {
      loadSettingsData();
    }
  };

  // ============================================================
  // LOAD SETTINGS DATA
  // ============================================================
  const loadSettingsData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/riders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const rider = data.riders.find(r => r._id === currentUser.id);
        if (rider) {
          setProfile({
            fullName: rider.fullName || '',
            phone: rider.phone || '',
            email: rider.email || '',
            vehicleType: rider.vehicleType || 'motorcycle',
            vehiclePlate: rider.vehiclePlate || '',
            city: rider.currentLocation?.city || '',
            state: rider.currentLocation?.state || '',
            radius: String(rider.serviceArea?.radius || 10),
            bankName: rider.bankDetails?.bankName || '',
            accountNumber: rider.bankDetails?.accountNumber || '',
            accountName: rider.bankDetails?.accountName || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // ============================================================
  // SAVE PROFILE
  // ============================================================
  const saveProfile = async () => {
    if (!profile.fullName || !profile.phone) {
      Alert.alert('⚠️ Missing Fields', 'Please fill in full name and phone.');
      return;
    }

    setSavingProfile(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          email: profile.email,
        })
      });

      const data = await response.json();
      if (data.success) {
        const updatedUser = { ...currentUser, name: profile.fullName, phone: profile.phone };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('✅ Success', 'Profile saved!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('❌ Error', 'Could not save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ============================================================
  // SAVE VEHICLE
  // ============================================================
  const saveVehicle = async () => {
    setSavingVehicle(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vehicleType: profile.vehicleType,
          vehiclePlate: profile.vehiclePlate,
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Vehicle details saved!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save vehicle error:', error);
      Alert.alert('❌ Error', 'Could not save vehicle');
    } finally {
      setSavingVehicle(false);
    }
  };

  // ============================================================
  // SAVE SERVICE AREA
  // ============================================================
  const saveServiceArea = async () => {
    setSavingService(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentLocation: {
            city: profile.city,
            state: profile.state,
          },
          serviceArea: {
            city: profile.city,
            state: profile.state,
            radius: parseInt(profile.radius) || 10,
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Service area saved!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save service error:', error);
      Alert.alert('❌ Error', 'Could not save service area');
    } finally {
      setSavingService(false);
    }
  };

  // ============================================================
  // SAVE BANK DETAILS
  // ============================================================
  const saveBankDetails = async () => {
    setSavingBank(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bankDetails: {
            bankName: profile.bankName,
            accountNumber: profile.accountNumber,
            accountName: profile.accountName,
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Bank details saved!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save bank error:', error);
      Alert.alert('❌ Error', 'Could not save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================
  const changePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      Alert.alert('⚠️ Missing Fields', 'Please fill in all password fields.');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      Alert.alert('⚠️ Error', 'New passwords do not match.');
      return;
    }

    if (passwords.new.length < 6) {
      Alert.alert('⚠️ Error', 'Password must be at least 6 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id,
          role: 'rider',
          currentPassword: passwords.current,
          newPassword: passwords.new
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Password changed!');
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Change password error:', error);
      Alert.alert('❌ Error', 'Could not change password');
    } finally {
      setSavingPassword(false);
    }
  };

  // ============================================================
  // HANDLE DELIVERY
  // ============================================================
  const handleDeliveryPress = (delivery) => {
    const deliveryAddress = delivery.shopId?.address;
    const pickupAddress = delivery.distributorId?.address;

    const buttons = [];

    if (delivery.status === 'confirmed') {
      buttons.push({ text: '📦 Pick Up', onPress: () => pickupOrder(delivery._id) });
    } else if (delivery.status === 'picked_up' || delivery.status === 'out_for_delivery') {
      buttons.push({ text: '🔑 Enter PIN', onPress: () => openPinEntry(delivery._id) });
    }

    buttons.push({ text: 'Close', style: 'cancel' });

    Alert.alert(
      `📦 Order #${delivery._id.slice(-6).toUpperCase()}`,
      `📥 Pickup: ${pickupAddress?.street || 'N/A'}, ${pickupAddress?.city || ''}\n\n` +
      `📦 Deliver: ${deliveryAddress?.street || 'N/A'}, ${deliveryAddress?.city || ''}\n\n` +
      `💰 Total: ₦${delivery.total?.toLocaleString()}`,
      buttons
    );
  };

  const pickupOrder = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'out_for_delivery', note: 'Rider picked up order' })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Picked Up', 'Order is now out for delivery!');
        loadDeliveries();
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not pick up order');
    }
  };

  const openPinEntry = (orderId) => {
    setSelectedDelivery(orderId);
    setPin('');
    setShowPinEntry(true);
  };

  const verifyPinAndDeliver = async () => {
    if (!pin || pin.length !== 4) {
      Alert.alert('⚠️ Invalid PIN', 'Please enter the 4-digit PIN.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${selectedDelivery}/verify-pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Delivered!', 'Order marked as delivered!');
        setShowPinEntry(false);
        setPin('');
        setSelectedDelivery(null);
        loadDeliveries();
      } else {
        Alert.alert('❌ Invalid PIN', data.error || 'Check the PIN and try again.');
        setPin('');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not verify PIN');
    }
  };

  // ============================================================
  // RENDER PIN ENTRY
  // ============================================================
  const renderPinEntry = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setShowPinEntry(false); setPin(''); setSelectedDelivery(null); }}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>🔑 Enter Delivery PIN</Text>
      <Text style={styles.subtitle}>Ask the customer for their 4-digit PIN</Text>

      <View style={styles.pinContainer}>
        <TextInput
          style={styles.pinInput}
          placeholder="• • • •"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
          maxLength={4}
          value={pin}
          onChangeText={setPin}
          autoFocus
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={verifyPinAndDeliver}>
        <Text style={styles.saveButtonText}>✅ Verify & Deliver</Text>
      </TouchableOpacity>

      <Text style={styles.pinHelp}>
        💡 The customer received this PIN via SMS when you were assigned this order.
      </Text>
    </>
  );

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================
  const renderDashboard = () => (
    <>
      <Text style={styles.title}>🏍️ Rider Dashboard</Text>
      <Text style={styles.subtitle}>Manage your deliveries.</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, styles.completedCard]}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Today's Deliveries</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : deliveries.length === 0 ? (
          <Text style={styles.emptyText}>No deliveries assigned.</Text>
        ) : (
          deliveries.slice(0, 5).map((delivery, index) => {
            const deliveryAddress = delivery.shopId?.address;
            const pickupAddress = delivery.distributorId?.address;
            return (
              <TouchableOpacity 
                key={index} 
                style={styles.deliveryItem} 
                onPress={() => handleDeliveryPress(delivery)}
              >
                <View>
                  <Text style={styles.deliveryId}>#{delivery._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.deliveryAddress}>📍 {deliveryAddress?.city || 'Unknown'} ← {pickupAddress?.city || 'Unknown'}</Text>
                  {delivery.status === 'confirmed' && (
                    <Text style={styles.actionHint}>Tap to pick up →</Text>
                  )}
                  {(delivery.status === 'picked_up' || delivery.status === 'out_for_delivery') && (
                    <Text style={styles.actionHint}>Tap to enter PIN →</Text>
                  )}
                </View>
                <View style={styles.deliveryRight}>
                  <Text style={styles.deliveryStatus}>{delivery.status?.toUpperCase()}</Text>
                  <Text style={styles.deliveryTotal}>₦{delivery.total?.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </>
  );

  // ============================================================
  // RENDER SETTINGS
  // ============================================================
  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage your rider preferences.</Text>

      {/* Profile */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>👤 Profile</Text>

        <Text style={styles.formLabel}>Full Name</Text>
        <TextInput
          style={styles.formInput}
          value={profile.fullName}
          onChangeText={(text) => setProfile({ ...profile, fullName: text })}
          placeholder="Full name"
          placeholderTextColor="#ADB5BD"
        />

        <Text style={styles.formLabel}>Phone Number</Text>
        <TextInput
          style={styles.formInput}
          value={profile.phone}
          onChangeText={(text) => setProfile({ ...profile, phone: text })}
          placeholder="Phone number"
          placeholderTextColor="#ADB5BD"
          keyboardType="phone-pad"
        />

        <Text style={styles.formLabel}>Email</Text>
        <TextInput
          style={styles.formInput}
          value={profile.email}
          onChangeText={(text) => setProfile({ ...profile, email: text })}
          placeholder="Email"
          placeholderTextColor="#ADB5BD"
          keyboardType="email-address"
        />

        <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={savingProfile}>
          {savingProfile ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Profile</Text>}
        </TouchableOpacity>
      </View>

      {/* Vehicle */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🏍️ Vehicle</Text>

        <Text style={styles.formLabel}>Vehicle Type</Text>
        <View style={styles.chipRow}>
          {['motorcycle', 'tricycle', 'bicycle', 'car', 'van'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, profile.vehicleType === type && styles.chipActive]}
              onPress={() => setProfile({ ...profile, vehicleType: type })}
            >
              <Text style={[styles.chipText, profile.vehicleType === type && styles.chipTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>Vehicle Plate</Text>
        <TextInput
          style={styles.formInput}
          value={profile.vehiclePlate}
          onChangeText={(text) => setProfile({ ...profile, vehiclePlate: text })}
          placeholder="e.g., LAG-123-AB"
          placeholderTextColor="#ADB5BD"
        />

        <TouchableOpacity style={styles.saveButton} onPress={saveVehicle} disabled={savingVehicle}>
          {savingVehicle ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Vehicle</Text>}
        </TouchableOpacity>
      </View>

      {/* Service Area */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>📍 Service Area</Text>

        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>City</Text>
            <TextInput
              style={styles.formInput}
              value={profile.city}
              onChangeText={(text) => setProfile({ ...profile, city: text })}
              placeholder="City"
              placeholderTextColor="#ADB5BD"
            />
          </View>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>State</Text>
            <TextInput
              style={styles.formInput}
              value={profile.state}
              onChangeText={(text) => setProfile({ ...profile, state: text })}
              placeholder="State"
              placeholderTextColor="#ADB5BD"
            />
          </View>
        </View>

        <Text style={styles.formLabel}>Service Radius (km)</Text>
        <TextInput
          style={styles.formInput}
          value={profile.radius}
          onChangeText={(text) => setProfile({ ...profile, radius: text })}
          placeholder="10"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.saveButton} onPress={saveServiceArea} disabled={savingService}>
          {savingService ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Service Area</Text>}
        </TouchableOpacity>
      </View>

      {/* Bank Details */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>💰 Bank Details</Text>

        <Text style={styles.formLabel}>Bank Name</Text>
        <TextInput
          style={styles.formInput}
          value={profile.bankName}
          onChangeText={(text) => setProfile({ ...profile, bankName: text })}
          placeholder="e.g., GTBank"
          placeholderTextColor="#ADB5BD"
        />

        <Text style={styles.formLabel}>Account Number</Text>
        <TextInput
          style={styles.formInput}
          value={profile.accountNumber}
          onChangeText={(text) => setProfile({ ...profile, accountNumber: text })}
          placeholder="e.g., 0123456789"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
        />

        <Text style={styles.formLabel}>Account Name</Text>
        <TextInput
          style={styles.formInput}
          value={profile.accountName}
          onChangeText={(text) => setProfile({ ...profile, accountName: text })}
          placeholder="e.g., Emeka Okafor"
          placeholderTextColor="#ADB5BD"
        />

        <TouchableOpacity style={styles.saveButton} onPress={saveBankDetails} disabled={savingBank}>
          {savingBank ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Bank Details</Text>}
        </TouchableOpacity>
      </View>

      {/* Password */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🔒 Change Password</Text>

        <Text style={styles.formLabel}>Current Password</Text>
        <TextInput
          style={styles.formInput}
          value={passwords.current}
          onChangeText={(text) => setPasswords({ ...passwords, current: text })}
          placeholder="Current password"
          placeholderTextColor="#ADB5BD"
          secureTextEntry={!showPassword}
        />

        <Text style={styles.formLabel}>New Password</Text>
        <TextInput
          style={styles.formInput}
          value={passwords.new}
          onChangeText={(text) => setPasswords({ ...passwords, new: text })}
          placeholder="New password"
          placeholderTextColor="#ADB5BD"
          secureTextEntry={!showPassword}
        />

        <Text style={styles.formLabel}>Confirm New Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={passwords.confirm}
            onChangeText={(text) => setPasswords({ ...passwords, confirm: text })}
            placeholder="Confirm new password"
            placeholderTextColor="#ADB5BD"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={changePassword} disabled={savingPassword}>
          {savingPassword ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>🔒 Change Password</Text>}
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[styles.settingsCard, styles.dangerCard]}>
        <Text style={[styles.settingsCardTitle, styles.dangerText]}>⚠️ Danger Zone</Text>
        <Text style={styles.dangerSubtitle}>Once you deactivate, there is no going back.</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={() => Alert.alert('Warning', 'Account deactivation coming soon!')}>
          <Text style={styles.dangerButtonText}>🗑️ Deactivate Account</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hello, {user?.name || 'Rider'}! 👋</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {showPinEntry 
          ? renderPinEntry() 
          : activeTab === 'dashboard' 
            ? renderDashboard() 
            : renderSettings()
        }
      </ScrollView>

      {!showPinEntry && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
            onPress={() => handleTabChange('dashboard')}
          >
            <Text style={styles.tabIcon}>📊</Text>
            <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
            onPress={() => handleTabChange('settings')}
          >
            <Text style={styles.tabIcon}>⚙️</Text>
            <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const COLORS = {
  primary: '#01311F',
  primaryDark: '#002B1C',
  secondary: '#4DBE18',
  background: '#FAF8F6',
  white: '#FFFFFF',
  gray: '#6C757D',
  lightGray: '#E9ECEF',
  pending: '#E65100',
  completed: '#1B5E20',
  danger: '#E17055',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  welcome: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  logoutButton: { padding: 8 },
  logoutText: { fontSize: 24 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '30%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pendingCard: { borderLeftWidth: 4, borderLeftColor: COLORS.pending },
  completedCard: { borderLeftWidth: 4, borderLeftColor: COLORS.completed },
  statNumber: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  loader: { marginVertical: 20 },
  deliveryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  deliveryId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  deliveryAddress: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  actionHint: { fontSize: 11, color: COLORS.secondary, fontWeight: '600', marginTop: 4 },
  deliveryRight: { alignItems: 'flex-end' },
  deliveryStatus: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: COLORS.lightGray, marginBottom: 4 },
  deliveryTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  emptyText: { color: COLORS.gray, textAlign: 'center', padding: 20 },
  // Settings
  settingsCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  settingsCardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 6, marginTop: 8 },
  formInput: { backgroundColor: COLORS.background, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 15, color: COLORS.primary },
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.lightGray },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  chipTextActive: { color: COLORS.white },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.primary },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 20 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  dangerCard: { borderWidth: 1, borderColor: COLORS.danger },
  dangerText: { color: COLORS.danger },
  dangerSubtitle: { fontSize: 13, color: COLORS.gray, marginBottom: 16 },
  dangerButton: { backgroundColor: COLORS.danger, borderRadius: 12