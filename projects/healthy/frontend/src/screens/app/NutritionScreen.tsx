/**
 * NutritionScreen — comidas del día con macros totales, buscador y registro.
 * FE-05: GET /nutrition/today + foods/search (debounce 300ms) + PUT meal complete.
 * N-2: resultados del buscador seleccionables.
 * N-3: modal para asignar comida + cantidad, con refresh automático de macros.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList, Modal, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { usePlanStore, calcDayTotals } from '@/stores/planStore';
import { MealCard }    from '@/components/ui/MealCard';
import { MacroCard }   from '@/components/ui/MacroCard';
import { colors }      from '@/theme/colors';
import { textStyles }  from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import api from '@/services/api';

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ height = 20, width = '100%', style }: { height?: number; width?: number | string; style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ height, width: width as any, borderRadius: 8, backgroundColor: colors.neutral.lightGray, opacity, marginBottom: 8 }, style]} />;
}

// ── Buscador de alimentos ─────────────────────────────────────────────────────

interface FoodResult {
  id: string; name: string; calories: number;
  protein: number; carbs: number; fat: number;
  from_cache?: boolean;
}

interface FoodSearchBarProps {
  meals: Array<{ id: string; name: string; icon: string }>;
  onFoodAdded: () => void;
}

function FoodSearchBar({ meals, onFoodAdded }: FoodSearchBarProps) {
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<FoodResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string>('');
  const [quantity,     setQuantity]     = useState('100');
  const [adding,       setAdding]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/foods/search?q=${encodeURIComponent(q.trim())}`);
      const foods = data?.data?.foods ?? data?.data ?? [];
      setResults(Array.isArray(foods) ? foods : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 300);
  };

  const handleAddFood = async () => {
    if (!selectedFood || !selectedMealId) return;
    setAdding(true);
    try {
      await api.post(`/nutrition/meals/${selectedMealId}/foods`, {
        food_id: selectedFood.id,
        quantity_g: parseFloat(quantity) || 100,
      });
      setSelectedFood(null);
      setQuery('');
      setResults([]);
      onFoodAdded();
    } catch {
      // silencioso — el usuario puede reintentar
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={srStyles.wrapper}>
      <View style={srStyles.inputRow}>
        <Text style={srStyles.icon}>🔍</Text>
        <TextInput
          style={srStyles.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder="Buscar alimentos…"
          placeholderTextColor={colors.neutral.midGray}
          accessibilityLabel="Buscar alimentos"
        />
        {searching && <ActivityIndicator size="small" color={colors.primary.green} />}
        {!searching && query.length > 0 && (
          <TouchableOpacity
            onPress={() => { setQuery(''); setResults([]); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Limpiar búsqueda"
          >
            <Text style={srStyles.clear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {results.length > 0 && (
        <View style={srStyles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={srStyles.resultRow}
                onPress={() => {
                  setSelectedFood(item);
                  setSelectedMealId(meals[0]?.id ?? '');
                  setQuantity('100');
                }}
                activeOpacity={0.7}
              >
                <View style={srStyles.resultInfo}>
                  <Text style={srStyles.resultName} numberOfLines={1}>{item.name}</Text>
                  <Text style={srStyles.resultMeta}>
                    {item.calories} kcal · P:{item.protein}g · C:{item.carbs}g · G:{item.fat}g
                  </Text>
                </View>
                <Text style={{ color: colors.primary.green, fontSize: 22, paddingLeft: 8 }}>+</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      {results.length === 0 && query.length > 0 && !searching && (
        <View style={srStyles.emptyState}>
          <Text style={srStyles.emptyText}>No se encontraron alimentos para &apos;{query}&apos;</Text>
        </View>
      )}

      {selectedFood && (
        <Modal transparent animationType="fade" visible={!!selectedFood} onRequestClose={() => setSelectedFood(null)}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.card}>
              <Text style={modalStyles.title}>Añadir a comida</Text>
              <Text style={modalStyles.foodName}>{selectedFood.name}</Text>
              <Text style={modalStyles.label}>Cantidad (gramos)</Text>
              <TextInput
                style={modalStyles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <Text style={modalStyles.label}>Comida del día</Text>
              <View style={modalStyles.mealsGrid}>
                {meals.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[modalStyles.mealBtn, selectedMealId === m.id && modalStyles.mealBtnActive]}
                    onPress={() => setSelectedMealId(m.id)}
                  >
                    <Text style={modalStyles.mealBtnIcon}>{m.icon}</Text>
                    <Text style={[modalStyles.mealBtnText, selectedMealId === m.id && modalStyles.mealBtnTextActive]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={modalStyles.actions}>
                <TouchableOpacity style={modalStyles.btnCancel} onPress={() => setSelectedFood(null)}>
                  <Text style={modalStyles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.btnAdd, adding && { opacity: 0.6 }]}
                  onPress={handleAddFood}
                  disabled={adding}
                >
                  <Text style={modalStyles.btnAddText}>{adding ? 'Añadiendo…' : 'Añadir'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function NutritionScreen() {
  const {
    todayMeals, targets,
    fetchTodayNutrition, completeMeal,
    isLoadingNutrition,
  } = usePlanStore();

  useEffect(() => { fetchTodayNutrition(); }, []);

  const totals    = calcDayTotals(todayMeals);
  const calPct    = Math.min(totals.calories / targets.calories, 1);
  const calLeft   = Math.max(targets.calories - Math.round(totals.calories), 0);
  const completed = todayMeals.filter((m) => m.completed).length;

  const handleToggleMeal = async (mealId: string) => {
    try {
      await completeMeal(mealId);
    } catch {
      // toggleMeal ya fue llamado localmente dentro de completeMeal; no hacer nada más
    }
  };

  if (isLoadingNutrition) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.scroll}>
        <SkeletonBlock height={30} width="50%" />
        <SkeletonBlock height={100} />
        <SkeletonBlock height={6} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <SkeletonBlock height={80} style={{ flex: 1 }} />
          <SkeletonBlock height={80} style={{ flex: 1 }} />
          <SkeletonBlock height={80} style={{ flex: 1 }} />
        </View>
        {[1,2,3].map(i => <SkeletonBlock key={i} height={90} />)}
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Cabecera */}
        <Text style={styles.title}>Nutrición</Text>
        <Text style={styles.sub}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        {/* Resumen calórico */}
        <View style={styles.calSummary}>
          <View style={styles.calMain}>
            <Text style={styles.calNum}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calUnit}>kcal consumidas</Text>
          </View>
          <View style={styles.calDivider} />
          <View style={styles.calSide}>
            <Text style={styles.calSideNum}>{targets.calories}</Text>
            <Text style={styles.calSideLabel}>objetivo</Text>
          </View>
          <View style={styles.calDivider} />
          <View style={styles.calSide}>
            <Text style={[styles.calSideNum, { color: calLeft > 0 ? colors.primary.darkGreen : '#DC2626' }]}>
              {calLeft}
            </Text>
            <Text style={styles.calSideLabel}>restantes</Text>
          </View>
        </View>

        {/* Barra calórica */}
        <View style={styles.calBar}>
          <View style={[styles.calFill, { width: `${calPct * 100}%` }]} />
        </View>

        {/* Macros */}
        <View style={styles.macroRow}>
          <MacroCard label="Proteína" current={totals.protein} target={targets.protein} color={colors.semantic.info}    />
          <MacroCard label="Carbos"   current={totals.carbs}   target={targets.carbs}   color={colors.semantic.warning} />
          <MacroCard label="Grasa"    current={totals.fat}     target={targets.fat}     color={colors.semantic.error}   />
        </View>

        {/* Progreso comidas */}
        <View style={styles.mealProgress}>
          <Text style={styles.mealProgressText}>{completed}/{todayMeals.length} comidas completadas</Text>
          <View style={styles.mealDots}>
            {todayMeals.map((m) => (
              <View key={m.id} style={[styles.dot, m.completed && styles.dotDone]} />
            ))}
          </View>
        </View>

        {/* Buscador de alimentos */}
        <Text style={styles.sectionTitle}>Buscar alimentos</Text>
        <FoodSearchBar
          meals={todayMeals.map(m => ({ id: m.id, name: m.name, icon: m.icon }))}
          onFoodAdded={fetchTodayNutrition}
        />

        {/* Tarjetas de comidas */}
        <Text style={styles.sectionTitle}>Plan de comidas</Text>
        {todayMeals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onToggle={handleToggleMeal}
          />
        ))}

        {/* Consejo del día */}
        <View style={styles.tip}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            Recuerda beber agua entre comidas. La hidratación mejora la absorción de nutrientes y reduce el hambre entre horas.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.neutral.offWhite },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title:  { ...textStyles.titleMedium, color: colors.neutral.black },
  sub:    { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg },

  calSummary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.neutral.white, borderRadius: borderRadius.card,
    padding: spacing.lg, ...shadows.card,
  },
  calMain:      { flex: 2, alignItems: 'center' },
  calNum:       { ...textStyles.titleLarge, color: colors.neutral.black },
  calUnit:      { ...textStyles.caption, color: colors.neutral.midGray },
  calDivider:   { width: 1, height: 40, backgroundColor: colors.neutral.lightGray, marginHorizontal: spacing.md },
  calSide:      { flex: 1, alignItems: 'center' },
  calSideNum:   { ...textStyles.titleSmall, color: colors.neutral.darkGray },
  calSideLabel: { ...textStyles.caption, color: colors.neutral.midGray },

  calBar: {
    height: 6, backgroundColor: colors.neutral.lightGray,
    borderRadius: borderRadius.pill, overflow: 'hidden',
    marginTop: spacing.sm, marginBottom: spacing.md,
  },
  calFill: { height: '100%', backgroundColor: colors.primary.green, borderRadius: borderRadius.pill },

  macroRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

  mealProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  mealProgressText: { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  mealDots: { flexDirection: 'row', gap: 6 },
  dot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.neutral.lightGray },
  dotDone:  { backgroundColor: colors.primary.green },

  sectionTitle: { ...textStyles.titleSmall, color: colors.neutral.black, marginBottom: spacing.sm, marginTop: spacing.md },

  tip: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.semantic.info + '12',
    borderRadius: borderRadius.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.semantic.info + '30',
    marginTop: spacing.sm,
  },
  tipIcon: { fontSize: 20 },
  tipText: { ...textStyles.bodyNormal, color: colors.semantic.info, flex: 1, lineHeight: 21 },
});

const srStyles = StyleSheet.create({
  wrapper:   { marginBottom: spacing.sm },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.neutral.white, borderRadius: borderRadius.input, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, ...shadows.card },
  icon:      { fontSize: 16 },
  input:     { flex: 1, ...textStyles.bodyNormal, color: colors.neutral.darkGray, height: 36 },
  clear:     { color: colors.neutral.midGray, fontSize: 16 },
  dropdown:  { backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, marginTop: 4, ...shadows.card, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.neutral.lightGray },
  resultInfo:{ flex: 1 },
  resultName:{ ...textStyles.bodyNormal, color: colors.neutral.darkGray, fontWeight: '600' },
  resultMeta:{ ...textStyles.caption, color: colors.neutral.midGray, marginTop: 2 },
  emptyState:{ backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, marginTop: 4, padding: spacing.md, alignItems: 'center', ...shadows.card },
  emptyText: { ...textStyles.bodyNormal, color: colors.neutral.midGray, textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card:             { backgroundColor: colors.neutral.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxl },
  title:            { ...textStyles.titleSmall, color: colors.neutral.black, marginBottom: spacing.xs },
  foodName:         { ...textStyles.bodyLarge, fontWeight: '600', color: colors.primary.darkGreen, marginBottom: spacing.md },
  label:            { ...textStyles.caption, color: colors.neutral.midGray, marginBottom: spacing.xs, marginTop: spacing.sm },
  input:            { borderWidth: 1.5, borderColor: colors.neutral.lightGray, borderRadius: borderRadius.input, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...textStyles.bodyNormal, color: colors.neutral.darkGray },
  mealsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  mealBtn:          { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.pill, borderWidth: 1.5, borderColor: colors.neutral.lightGray },
  mealBtnActive:    { borderColor: colors.primary.green, backgroundColor: colors.primary.lightGreen },
  mealBtnIcon:      { fontSize: 16 },
  mealBtnText:      { ...textStyles.bodyNormal, color: colors.neutral.darkGray },
  mealBtnTextActive:{ color: colors.primary.darkGreen, fontWeight: '600' },
  actions:          { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  btnCancel:        { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.button, borderWidth: 1.5, borderColor: colors.neutral.lightGray, alignItems: 'center' },
  btnCancelText:    { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  btnAdd:           { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.button, backgroundColor: colors.primary.green, alignItems: 'center' },
  btnAddText:       { ...textStyles.bodyNormal, fontWeight: '700', color: '#FFFFFF' },
});

export default NutritionScreen;
