import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../state/auth';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';

import EventsListScreen from '../screens/events/EventsListScreen';
import EventDetailScreen from '../screens/events/EventDetailScreen';
import SearchEventsScreen from '../screens/search/SearchEventsScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';

export type AuthStackParams = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  VerifyEmail: { email: string };
  Settings: undefined;
};

export type EventsStackParams = {
  EventsList: undefined;
  EventDetail: { eventId: string; eventName: string; ownerId: string };
};

export type SearchStackParams = {
  SearchEvents: undefined;
  EventDetail: { eventId: string; eventName: string; ownerId: string };
};

export type ProfileStackParams = {
  Profile: undefined;
  Settings: undefined;
  ChangePassword: undefined;
};

// Cabecera oscura para las pantallas de pila que la muestran
const darkHeader = { headerStyle: { backgroundColor: '#121212' }, headerTintColor: '#fff' };

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const EventsStack = createNativeStackNavigator<EventsStackParams>();
const SearchStack = createNativeStackNavigator<SearchStackParams>();
const ProfileStack = createNativeStackNavigator<ProfileStackParams>();
const Tabs = createBottomTabNavigator();

function EventsNavigator() {
  return (
    <EventsStack.Navigator>
      <EventsStack.Screen name="EventsList" component={EventsListScreen} options={{ title: 'Eventos' }} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} options={({ route }) => ({ title: route.params.eventName })} />
    </EventsStack.Navigator>
  );
}

function SearchNavigator() {
  return (
    <SearchStack.Navigator>
      <SearchStack.Screen name="SearchEvents" component={SearchEventsScreen} options={{ title: 'Buscar' }} />
      <SearchStack.Screen name="EventDetail" component={EventDetailScreen} options={({ route }) => ({ title: route.params.eventName })} />
    </SearchStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Contraseña' }} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#121212', borderTopColor: '#222' },
      tabBarActiveTintColor: '#1db954',
      tabBarInactiveTintColor: '#888',
    }}>
      <Tabs.Screen name="Eventos" component={EventsNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="Buscar" component={SearchNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="Amigos" component={FriendsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />, headerShown: true, headerStyle: { backgroundColor: '#121212' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }} />
      <Tabs.Screen name="Perfil" component={ProfileNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { token, hydrating } = useAuth();

  if (hydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1db954" />
      </View>
    );
  }

  return token ? (
    <MainTabs />
  ) : (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="Settings" component={SettingsScreen}
        options={{ headerShown: true, title: 'Ajustes', ...darkHeader }} />
    </AuthStack.Navigator>
  );
}
