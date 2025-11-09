import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Clipboard,
} from 'react-native';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import { WalletCore, WalletAccount } from './crypto/WalletCore';
import { SecureStorage } from './storage/SecureStorage';

type Screen = 'loading' | 'welcome' | 'create' | 'import' | 'unlock' | 'wallet';

const App = (): JSX.Element => {
  const [screen, setScreen] = useState<Screen>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [wallet, setWallet] = useState<WalletCore | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(null);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    const hasWallet = await SecureStorage.hasWallet();
    if (hasWallet) {
      setScreen('unlock');
    } else {
      setScreen('welcome');
    }
  };

  const handleCreateWallet = () => {
    const newWallet = new WalletCore();
    const newMnemonic = newWallet.generateWallet();
    setMnemonic(newMnemonic);
    setWallet(newWallet);
    setScreen('create');
  };

  const handleSaveWallet = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      await SecureStorage.saveWallet(mnemonic, password);
      setAccounts(wallet?.getAccounts() || []);
      setSelectedAccount(wallet?.getAccounts()[0] || null);
      setPassword('');
      setConfirmPassword('');
      setScreen('wallet');
    } catch (error) {
      Alert.alert('Error', 'Failed to save wallet');
    }
  };

  const handleImportWallet = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      const newWallet = new WalletCore();
      newWallet.importWallet(mnemonic.trim());
      await SecureStorage.saveWallet(mnemonic.trim(), password);
      setWallet(newWallet);
      setAccounts(newWallet.getAccounts());
      setSelectedAccount(newWallet.getAccounts()[0]);
      setPassword('');
      setConfirmPassword('');
      setMnemonic('');
      setScreen('wallet');
    } catch (error) {
      Alert.alert('Error', 'Invalid mnemonic phrase');
    }
  };

  const handleUnlock = async () => {
    try {
      const loadedMnemonic = await SecureStorage.loadWallet(password);
      const loadedWallet = new WalletCore();
      loadedWallet.importWallet(loadedMnemonic);
      setWallet(loadedWallet);
      setAccounts(loadedWallet.getAccounts());
      setSelectedAccount(loadedWallet.getAccounts()[0]);
      setPassword('');
      setScreen('wallet');
    } catch (error) {
      Alert.alert('Error', 'Incorrect password');
    }
  };

  const handleLogout = () => {
    wallet?.clear();
    setWallet(null);
    setAccounts([]);
    setSelectedAccount(null);
    setScreen('unlock');
  };

  const handleAddAccount = () => {
    if (!wallet) return;

    Alert.alert('Add Account', 'Choose blockchain', [
      {
        text: 'Solana',
        onPress: () => {
          const account = wallet.addAccount('solana');
          setAccounts(wallet.getAccounts());
          Alert.alert('Success', `Created Solana account:\n${account.publicKey}`);
        },
      },
      {
        text: 'Ethereum',
        onPress: () => {
          const account = wallet.addAccount('ethereum');
          setAccounts(wallet.getAccounts());
          Alert.alert('Success', `Created Ethereum account:\n${account.publicKey}`);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleShowPrivateKey = (account: WalletAccount) => {
    if (!wallet) return;

    Alert.alert(
      'Warning',
      'Never share your private key. Anyone with this key can access your funds.',
      [
        {
          text: 'Show Private Key',
          style: 'destructive',
          onPress: () => {
            const privateKey = wallet.getPrivateKey(account.publicKey);
            Alert.alert('Private Key', privateKey, [
              {
                text: 'Copy',
                onPress: () => Clipboard.setString(privateKey),
              },
              { text: 'Close' },
            ]);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  // Welcome Screen
  if (screen === 'welcome') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Simple Crypto Wallet</Text>
          <Text style={styles.subtitle}>Get started with your wallet</Text>
          <TouchableOpacity style={styles.button} onPress={handleCreateWallet}>
            <Text style={styles.buttonText}>Create New Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => setScreen('import')}>
            <Text style={styles.buttonText}>Import Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Create Wallet Screen
  if (screen === 'create') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>Your Recovery Phrase</Text>
          <Text style={styles.warning}>
            Write down these words in order and keep them safe. This is the ONLY way to
            recover your wallet.
          </Text>
          <View style={styles.mnemonicContainer}>
            <Text style={styles.mnemonic}>{mnemonic}</Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyToClipboard(mnemonic)}>
            <Text style={styles.buttonText}>Copy to Clipboard</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Set Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleSaveWallet}>
            <Text style={styles.buttonText}>Save Wallet</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Import Wallet Screen
  if (screen === 'import') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>Import Wallet</Text>
          <Text style={styles.label}>Recovery Phrase</Text>
          <TextInput
            style={[styles.input, styles.mnemonicInput]}
            placeholder="Enter your 12 or 24 word phrase"
            multiline
            numberOfLines={3}
            value={mnemonic}
            onChangeText={setMnemonic}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Set Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleImportWallet}>
            <Text style={styles.buttonText}>Import Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => setScreen('welcome')}>
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Unlock Screen
  if (screen === 'unlock') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.label}>Enter Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleUnlock}
          />
          <TouchableOpacity style={styles.button} onPress={handleUnlock}>
            <Text style={styles.buttonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Wallet Screen
  if (screen === 'wallet' && selectedAccount) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={styles.title}>My Wallet</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.accountSelector}>
            <Text style={styles.label}>Active Account</Text>
            <View style={styles.accountInfo}>
              <Text style={styles.blockchain}>
                {selectedAccount.blockchain.toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={() => copyToClipboard(selectedAccount.publicKey)}>
                <Text style={styles.address} numberOfLines={1}>
                  {selectedAccount.publicKey}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => handleShowPrivateKey(selectedAccount)}>
            <Text style={styles.buttonText}>Show Private Key</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Accounts</Text>
            {accounts.map((account, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.accountCard,
                  selectedAccount.publicKey === account.publicKey &&
                    styles.accountCardActive,
                ]}
                onPress={() => setSelectedAccount(account)}>
                <Text style={styles.accountBlockchain}>
                  {account.blockchain.toUpperCase()}
                </Text>
                <Text style={styles.accountAddress} numberOfLines={1}>
                  {account.publicKey}
                </Text>
                <Text style={styles.accountPath}>{account.derivationPath}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAddAccount}>
            <Text style={styles.buttonText}>+ Add Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#16213e',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  mnemonicInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#0f3460',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonSecondary: {
    backgroundColor: '#16213e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#c70039',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  copyButton: {
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#c70039',
    fontSize: 14,
    fontWeight: '600',
  },
  mnemonicContainer: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 10,
    marginTop: 12,
  },
  mnemonic: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  warning: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  accountSelector: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  accountInfo: {
    marginTop: 8,
  },
  blockchain: {
    color: '#4ecca3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  address: {
    color: '#fff',
    fontSize: 14,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountCardActive: {
    borderColor: '#0f3460',
  },
  accountBlockchain: {
    color: '#4ecca3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountAddress: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  accountPath: {
    color: '#888',
    fontSize: 12,
  },
});

export default App;
