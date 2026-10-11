/**
 * MainTabNavigator — barra de tabs inferior con blur y punto indicador
 * 5 tabs: Inicio, Entrenamiento, Nutrición, Progreso, Perfil
 */

import React from 'react';
import {
  Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { BlurView }                    from 'expo-blur';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';
import { Ionicons }                    from '@expo/vector-icons';
import { HomeScreen }                  from '@/screens/app/HomeScreen';
import { TrainingScreen }              from '@/screens/app/TrainingScreen';
import { NutritionScreen }             from '@/screens/app/NutritionScreen';
import { ProgressScreen }              from '@/screens/app/ProgressScreen';
import { ProfileScreen }               from '@/screens/app/ProfileScreen';
import { colors }                      from '@/theme/colors';
import { iconSize, spacing } from '@/theme/spacing';

export type MainTabParamList = {
  Home:      undefined;
  Training:  undefined;
  Nutrition: undefined;
  Progress:  undefined;
  Profile:   undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Configuración de cada tab
const TABS: {
  name:        keyof MainTabParamList;
  label:       string;
  iconOutline: React.ComponentProps<typeof Ionicons>['name'];
  iconFilled:  React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { name: 'Home',      label: 'Inicio',       iconOutline: 'home-outline',      iconFilled: 'home'           },
  { name: 'Training',  label: 'Entrena',      iconOutline: 'barbell-outline',   iconFilled: 'barbell'        },
  { name: 'Nutrition', label: 'Nutrición',    iconOutline: 'nutrition-outline', iconFilled: 'nutrition'      },
  { name: 'Progress',  label: 'Progreso',     iconOutline: 'stats-chart-outline',iconFilled:'stats-chart'    },
  { name: 'Profile',   label: 'Perfil',       iconOutline: 'person-outline',    iconFilled: 'person'         },
];

// ── Tab bar personalizado ───────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={barStyles.wrapper} pointerEvents="box-none">
      <BlurView intensity={80} tint="light" style={barStyles.blur}>
        <View style={barStyles.row}>
          {state.routes.map((route: any, index: number) => {
            const { options }  = descriptors[route.key];
            const tab          = TABS[index];
            const isActive     = state.index === index;

            const handlePress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isActive && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                style={barStyles.tab}
                onPress={handlePress}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.label}
              >
                <View style={barStyles.iconWrap}>
                  <Ionicons
                    name={isActive ? tab.iconFilled : tab.iconOutline}
                    size={iconSize.standard}
                    color={isActive ? colors.primary.darkGreen : colors.neutral.midGray}
                  />
                </View>
                <Text style={[barStyles.label, isActive && barStyles.labelActive]}>
                  {tab.label}
                </Text>
                {/* Punto indicador bajo el icono activo */}
                {isActive && <View style={barStyles.dot} />}
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ── Navegador ───────────────────────────────────────────────────────────────

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"      component={HomeScreen}      />
      <Tab.Screen name="Training"  component={TrainingScreen}  />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Progress"  component={ProgressScreen}  />
      <Tab.Screen name="Profile"   component={ProfileScreen}   />
    </Tab.Navigator>
  );
}

const BAR_HEIGHT   = 60;
const BOTTOM_INSET = Platform.OS === 'ios' ? 28 : 0;
const DOT_SIZE     = 4;

const barStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 20, elevation: 10,
  },
  blur: {
    width: '100%',
    height: BAR_HEIGHT + BOTTOM_INSET,
    paddingBottom: BOTTOM_INSET,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  row: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-around',
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.xs, minHeight: 44,
  },
  iconWrap: {
    alignItems: 'center', justifyContent: 'center',
    width: iconSize.featured, height: iconSize.featured,
  },
  label: {
    fontSize: 10, fontWeight: '500', color: colors.neutral.midGray,
    marginTop: 1,
  },
  labelActive: { color: colors.primary.darkGreen, fontWeight: '700' },
  dot: {
    marginTop: 3, width: DOT_SIZE, height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2, backgroundColor: colors.primary.darkGreen,
  },
});
