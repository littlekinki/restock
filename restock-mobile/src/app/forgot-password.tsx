import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

const COLORS = {
  primary: '#01311F',
  secondary: '#4DBE18',
  background: '#FAF8F6',
  white: '#FFFFFF',
  gray: '#6C757D',
  lightGray: '#E9ECEF',
};

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('shop');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ============================================================
  // STEP 1 — REQUEST OTP
  // ============================================================
  const handleRequestOTP = async () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), role }),
      });
      const data = await response.json();

      if (data.success) {
        Alert.alert('📱 Code sent', 'Check your phone for the 6-digit code.');
        setStep(2);
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to send code');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not connect. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // STEP 2 — VERIFY OTP
  // ============================================================
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), role, otp: otp.trim() }),
      });
      const data = await response.json();

      if (data.success) {
        setStep(3);
      } else {
        Alert.alert('❌ Invalid code', data.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not connect. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // STEP 3 — RESET PASSWORD
  // ============================================================
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          role,
          otp: otp.trim(),
          newPassword,
        }),
      });
      const data = await response.json();

      if (data.success) {
        Alert.alert(
          '✅ Password reset!',
          'You can now log in with your new password.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not connect. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>← Back to Login</Text>
          </TouchableOpacity>

          <Text style={styles.title}>🔑 Forgot Password</Text>
          <Text style={styles.subtitle}>
            {step === 1 && 'Enter your phone number to receive a code.'}
            {step === 2 && 'Enter the 6-digit code we sent you.'}
            {step === 3 && 'Choose a new password.'}
          </Text>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
          </View>

          {/* ============ STEP 1 ============ */}
          {step === 1 && (
            <>
              <View style={styles.roleContainer}>
                {['shop', 'distributor', 'rider'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleButton, role === r && styles.roleButtonActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text
                      style={[styles.roleText, role === r && styles.roleTextActive]}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#ADB5BD"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRequestOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>📱 Send Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ============ STEP 2 ============ */}
          {step === 2 && (
            <>
              <Text style={styles.hintText}>
                Code sent to <Text style={styles.hintBold}>{phone}</Text>
              </Text>

              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="• • • • • •"
                placeholderTextColor="#ADB5BD"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleVerifyOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>✅ Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRequestOTP}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ============ STEP 3 ============ */}
          {step === 3 && (
            <>
              <Text style={styles.formLabel}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter new password"
                  placeholderTextColor="#ADB5BD"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter new password"
                placeholderTextColor="#ADB5BD"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>🔒 Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  backButton: { position: 'absolute', top: 20, left: 24, zIndex: 10, padding: 8 },
  backButtonText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.lightGray,
  },
  stepDotActive: { backgroundColor: COLORS.secondary },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.lightGray,
  },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleText: { color: COLORS.gray, fontWeight: '500', fontSize: 13 },
  roleTextActive: { color: COLORS.primary, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    fontSize: 16,
    color: COLORS.primary,
  },
  otpInput: {
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 12,
    fontWeight: '700',
    paddingVertical: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
    marginTop: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: COLORS.primary,
  },
  eyeButton: { padding: 16 },
  eyeIcon: { fontSize: 20 },
  hintText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 16,
  },
  hintBold: { fontWeight: '700', color: COLORS.primary },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: COLORS.secondary, fontWeight: '600', fontSize: 14 },
});