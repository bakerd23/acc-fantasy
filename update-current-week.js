const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateCurrentWeek() {
  try {
    // Get league settings
    const leagueDoc = await db.collection('league').doc('main').get();
    const leagueData = leagueDoc.data();
    const weekDates = leagueData.weekDates || [];

    // Get current date
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find which week we're in
    let currentWeek = 1;
    for (const week of weekDates) {
      const startDate = week.startDate;
      const endDate = week.endDate;
      
      if (today >= startDate && today <= endDate) {
        currentWeek = week.week;
        break;
      }
      
      // If we're past this week's end date, check next week
      if (today > endDate && week.week > currentWeek) {
        currentWeek = week.week;
      }
    }

    console.log(`Today: ${today}`);
    console.log(`Calculated current week: ${currentWeek}`);

    // Update in Firebase
    await db.collection('league').doc('main').update({
      currentWeek: currentWeek
    });

    console.log(`✓ Updated current week to ${currentWeek}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateCurrentWeek();