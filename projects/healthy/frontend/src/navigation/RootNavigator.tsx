/**
 * RootNavigator — decide entre Auth stack, Onboarding y App tabs.
 * Al autenticarse navega a Onboarding si el usuario no tiene plan todavía,
 * o directamente a MainTabs si ya tiene un plan activo.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, View }    from 'react-native';
import { NavigationContainer }        from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView }     from 'react-native-gesture-handler';
import { useAuthStore }               from '@/stores/authStore';
import { colors }                     from '@/theme/colors';

// Auth
import { WelcomeScreen }        from '@/screens/auth/WelcomeScreen';
import { RegisterScreen }       from '@/screens/auth/RegisterScreen';
import { VerifyEmailScreen }    from '@/screens/auth/VerifyEmailScreen';
import { SetPasswordScreen }    from '@/screens/auth/SetPasswordScreen';
import { LoginScreen }          from '@/screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';

// Onboarding
import { OnboardingWelcome }    from '@/screens/onboarding/OnboardingWelcome';
import { OnboardingGoal }       from '@/screens/onboarding/OnboardingGoal';
import { OnboardingProfile }    from '@/screens/onboarding/OnboardingProfile';
import { OnboardingLifestyle }  from '@/screens/onboarding/OnboardingLifestyle';
import { OnboardingTraining }   from '@/screens/onboarding/OnboardingTraining';
import { OnboardingNutrition }  from '@/screens/onboarding/OnboardingNutrition';
import { OnboardingHealth }     from '@/screens/onboarding/OnboardingHealth';
import { OnboardingMotivation } from '@/screens/onboarding/OnboardingMotivation';
import { OnboardingComplete }   from '@/screens/onboarding/OnboardingComplete';

// App principal
import { MainTabNavigator }     from './MainTabNavigator';

export type RootStackParamList = {
  // Auth
  Welcome:        undefined;
  Register:       undefined;
  VerifyEmail:    { email: string };
  SetPassword:    { email: string; code: string };
  Login:          undefined;
  ForgotPassword: undefined;
  // Onboarding
  OnboardingWelcome:    undefined;
  OnboardingGoal:       undefined;
  OnboardingProfile:    undefined;
  OnboardingLifestyle:  undefined;
  OnboardingTraining:   undefined;
  OnboardingNutrition:  undefined;
  OnboardingHealth:     undefined;
  OnboardingMotivation: undefined;
  OnboardingComplete:   undefined;
  // App
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading, user, loadStoredAuth } = useAuthStore();

  useEffect(() => { loadStoredAuth(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral.white }}>
        <ActivityIndicator size="large" color={colors.primary.green} />
      </View>
    );
  }

  // Decidir la pantalla inicial cuando está autenticado
  const hasPlan = user?.has_plan ?? false;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown:  false,
          animation:    'slide_from_right',
          contentStyle: { backgroundColor: colors.neutral.white },
        }}
      >
        {isAuthenticated ? (
          hasPlan ? (
            // Ya tiene plan activo → ir directo a la app
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              {/* Onboarding accesible por si se redirige desde SetPassword con plan nuevo */}
              <Stack.Screen name="OnboardingWelcome"    component={OnboardingWelcome} />
              <Stack.Screen name="OnboardingGoal"       component={OnboardingGoal} />
              <Stack.Screen name="OnboardingProfile"    component={OnboardingProfile} />
              <Stack.Screen name="OnboardingLifestyle"  component={OnboardingLifestyle} />
              <Stack.Screen name="OnboardingTraining"   component={OnboardingTraining} />
              <Stack.Screen name="OnboardingNutrition"  component={OnboardingNutrition} />
              <Stack.Screen name="OnboardingHealth"     component={OnboardingHealth} />
              <Stack.Screen name="OnboardingMotivation" component={OnboardingMotivation} />
              <Stack.Screen name="OnboardingComplete"   component={OnboardingComplete}
                options={{ gestureEnabled: false }} />
            </>
          ) : (
            // Autenticado pero sin plan → onboarding
            <>
              <Stack.Screen name="OnboardingWelcome"    component={OnboardingWelcome} />
              <Stack.Screen name="OnboardingGoal"       component={OnboardingGoal} />
              <Stack.Screen name="OnboardingProfile"    component={OnboardingProfile} />
              <Stack.Screen name="OnboardingLifestyle"  component={OnboardingLifestyle} />
              <Stack.Screen name="OnboardingTraining"   component={OnboardingTraining} />
              <Stack.Screen name="OnboardingNutrition"  component={OnboardingNutrition} />
              <Stack.Screen name="OnboardingHealth"     component={OnboardingHealth} />
              <Stack.Screen name="OnboardingMotivation" component={OnboardingMotivation} />
              <Stack.Screen name="OnboardingComplete"   component={OnboardingComplete}
                options={{ gestureEnabled: false }} />
              <Stack.Screen name="MainTabs"             component={MainTabNavigator} />
            </>
          )
        ) : (
          // No autenticado → auth flow
          <>
            <Stack.Screen name="Welcome"        component={WelcomeScreen} />
            <Stack.Screen name="Register"       component={RegisterScreen} />
            <Stack.Screen name="VerifyEmail"    component={VerifyEmailScreen} />
            <Stack.Screen name="SetPassword"    component={SetPasswordScreen} />
            <Stack.Screen name="Login"          component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}
