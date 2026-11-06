// Demo web stand-in for @kingstinct/react-native-healthkit. A browser has no
// Apple Health, so without this every report opened with "Apple Health did not
// have new data to sync". It answers like a phone whose watch recorded today's
// activity: the app sends those numbers to the server (the replay keeps the
// recorded day) and reports a normal sync. No sleep or workout samples.
const TODAY = {
  HKQuantityTypeIdentifierActiveEnergyBurned: 420,
  HKQuantityTypeIdentifierBasalEnergyBurned: 1180,
  HKQuantityTypeIdentifierStepCount: 6400,
};
module.exports = {
  requestAuthorization: async () => true,
  isHealthDataAvailable: () => true,
  queryStatisticsForQuantity: async (identifier) => (identifier in TODAY ? { sumQuantity: { quantity: TODAY[identifier], unit: '' } } : {}),
  getMostRecentQuantitySample: async () => undefined,
  queryCategorySamples: async () => [],
  queryWorkoutSamples: async () => [],
  queryQuantitySamples: async () => [],
};
