import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useOffline } from '../../../services/offline/OfflineContext';
import { Decision, previewReadingResult, validateForSubmit } from '../../../services/offline/syncCore';

const num = (s: string): number | undefined => {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

export default function Inspect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, saveDraftPatch, addReadingTo, addObservationTo, removeFrom, finish } = useOffline();
  const draft = id ? state.drafts[id] : undefined;

  const [readingType, setReadingType] = useState('Accuracy');
  const [expected, setExpected] = useState('');
  const [observed, setObserved] = useState('');
  const [unit, setUnit] = useState('kg');
  const [tolerance, setTolerance] = useState('');
  const [obsType, setObsType] = useState('Seal condition');
  const [obsValue, setObsValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [locating, setLocating] = useState(false);

  if (!draft) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Inspection not found on this phone</Text>
        <Pressable onPress={() => router.replace('/inspector/offline')}>
          <Text style={styles.link}>Back to field work</Text>
        </Pressable>
      </View>
    );
  }

  const locked = draft.state === 'READY' || draft.state === 'SYNCED';
  const draftId = draft.clientId;

  const captureGps = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location not allowed', 'You can still save the inspection without GPS, but evidence is stronger with it.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      saveDraftPatch(draftId, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      Alert.alert('Could not get a GPS fix', 'Try again outdoors, or continue without it.');
    } finally {
      setLocating(false);
    }
  };

  const addReading = () => {
    const observedValue = num(observed);
    if (observedValue === undefined || !readingType.trim() || !unit.trim()) {
      Alert.alert('Reading incomplete', 'Enter a type, the observed value and the unit.');
      return;
    }
    addReadingTo(draftId, {
      readingType: readingType.trim(),
      expectedValue: num(expected),
      observedValue,
      unit: unit.trim(),
      tolerance: num(tolerance),
    });
    setObserved('');
  };

  const addObservation = () => {
    if (!obsType.trim()) return;
    addObservationTo(draftId, { observationType: obsType.trim(), observedValue: obsValue.trim() || undefined });
    setObsValue('');
  };

  const submit = (decision: Decision) => {
    const problems = validateForSubmit(draft, decision);
    if (problems.length) {
      Alert.alert('Cannot save yet', problems.join('\n'));
      return;
    }
    Alert.alert(`Save result ${decision}?`, 'The result is uploaded when you are online and cannot be changed afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: () => {
          finish(draftId, decision, remarks.trim() || undefined);
          router.replace('/inspector/offline');
        },
      },
    ]);
  };

  const failing = draft.readings.filter((r) => previewReadingResult(r) === 'FAIL').length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>{draft.applicationNumber}</Text>
        <Text style={styles.sub}>{draft.instrumentName}</Text>
        {draft.state === 'NEEDS_ATTENTION' && <Text style={styles.error}>Server said: {draft.error}</Text>}
        {locked && <Text style={styles.note}>This inspection is {draft.state === 'SYNCED' ? 'uploaded' : 'saved and waiting to upload'} and can no longer be edited.</Text>}

        <Text style={styles.section}>Location</Text>
        <TextInput style={styles.input} editable={!locked} placeholder="Where is the instrument? (shop, address)" value={draft.location || ''} onChangeText={(t) => saveDraftPatch(draftId, { location: t })} />
        <Pressable style={[styles.secondary, (locked || locating) && styles.disabled]} disabled={locked || locating} onPress={captureGps}>
          <Text style={styles.secondaryText}>
            {locating ? 'Getting GPS...' : draft.latitude !== undefined ? `GPS ${draft.latitude?.toFixed(5)}, ${draft.longitude?.toFixed(5)} - update` : 'Capture GPS position'}
          </Text>
        </Pressable>

        <Text style={styles.section}>Readings ({draft.readings.length})</Text>
        {draft.readings.map((r) => {
          const p = previewReadingResult(r);
          return (
            <View key={r.clientId} style={styles.item}>
              <Text style={styles.itemText}>
                {r.readingType}: {r.observedValue} {r.unit}
                {r.expectedValue !== undefined ? ` (expected ${r.expectedValue}${r.tolerance !== undefined ? ` ±${r.tolerance}` : ''})` : ''}
              </Text>
              <Text style={[styles.badge, p === 'FAIL' ? styles.fail : p === 'PASS' ? styles.pass : styles.neutral]}>{p || 'n/a'}</Text>
              {!locked && (
                <Pressable onPress={() => removeFrom(draftId, 'readings', r.clientId)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {!locked && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Reading type (e.g. Accuracy at 10 kg)" value={readingType} onChangeText={setReadingType} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.flex]} placeholder="Expected" keyboardType="decimal-pad" value={expected} onChangeText={setExpected} />
              <TextInput style={[styles.input, styles.flex]} placeholder="Observed" keyboardType="decimal-pad" value={observed} onChangeText={setObserved} />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.flex]} placeholder="Tolerance ±" keyboardType="decimal-pad" value={tolerance} onChangeText={setTolerance} />
              <TextInput style={[styles.input, styles.flex]} placeholder="Unit" value={unit} onChangeText={setUnit} />
            </View>
            <Text style={styles.hint}>
              {previewReadingResult({ expectedValue: num(expected), observedValue: num(observed) ?? NaN, tolerance: num(tolerance) }) ?? 'Add expected + tolerance to see PASS/FAIL'}
              {' '}(the server makes the final decision)
            </Text>
            <Pressable style={styles.secondary} onPress={addReading}>
              <Text style={styles.secondaryText}>Add reading</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.section}>Observations ({draft.observations.length})</Text>
        {draft.observations.map((o) => (
          <View key={o.clientId} style={styles.item}>
            <Text style={styles.itemText}>
              {o.observationType}
              {o.observedValue ? `: ${o.observedValue}` : ''}
            </Text>
            {!locked && (
              <Pressable onPress={() => removeFrom(draftId, 'observations', o.clientId)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}
        {!locked && (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Observation (e.g. Seal condition)" value={obsType} onChangeText={setObsType} />
            <TextInput style={styles.input} placeholder="Finding (e.g. intact)" value={obsValue} onChangeText={setObsValue} />
            <Pressable style={styles.secondary} onPress={addObservation}>
              <Text style={styles.secondaryText}>Add observation</Text>
            </Pressable>
          </View>
        )}

        {!locked && (
          <>
            <Text style={styles.section}>Result</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} multiline placeholder="Remarks (optional)" value={remarks} onChangeText={setRemarks} />
            {failing > 0 && <Text style={styles.error}>{failing} reading(s) outside tolerance - result can only be FAIL.</Text>}
            <View style={styles.row}>
              <Pressable style={[styles.decide, styles.passBtn, failing > 0 && styles.disabled]} onPress={() => submit('PASS')}>
                <Text style={styles.decideText}>Save PASS</Text>
              </Pressable>
              <Pressable style={[styles.decide, styles.failBtn]} onPress={() => submit('FAIL')}>
                <Text style={styles.decideText}>Save FAIL</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingTop: 48, gap: 8, backgroundColor: '#F8FAFC' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  sub: { color: '#475569' },
  section: { marginTop: 10, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  link: { color: '#1D4ED8', fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  form: { gap: 8, backgroundColor: '#F1F5F9', padding: 10, borderRadius: 12 },
  hint: { color: '#475569', fontSize: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  itemText: { flex: 1, color: '#0F172A', fontSize: 13 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pass: { color: '#15803D', backgroundColor: '#DCFCE7' },
  fail: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  neutral: { color: '#475569', backgroundColor: '#E2E8F0' },
  remove: { color: '#B91C1C', fontSize: 12 },
  secondary: { borderWidth: 1, borderColor: '#1D4ED8', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: '#1D4ED8', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  decide: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  passBtn: { backgroundColor: '#15803D' },
  failBtn: { backgroundColor: '#B91C1C' },
  decideText: { color: '#fff', fontWeight: '800' },
  error: { color: '#B91C1C', fontSize: 13 },
  note: { color: '#92400E', fontSize: 13 },
});
