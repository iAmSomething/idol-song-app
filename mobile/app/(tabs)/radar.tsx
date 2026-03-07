import { StyleSheet, Text, View } from 'react-native';

export default function RadarTabScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TAB SHELL</Text>
      <Text style={styles.title}>Radar</Text>
      <Text style={styles.body}>
        Featured upcoming, weekly picks, long-gap, rookie, and change-feed sections will land inside
        this tab without changing the top-level route structure.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f7f6f2',
  },
  eyebrow: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#87634d',
  },
  title: {
    marginBottom: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#1f1b17',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5e554d',
  },
});
