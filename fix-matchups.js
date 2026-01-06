// fix-matchups.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixMatchups() {
  try {
    // Get the old matchup documents
    const week2Old = await db.collection('matchups').doc('2_aaron_pizza').get();
    const week7Old = await db.collection('matchups').doc('7_aaron_pizza').get();

    if (!week2Old.exists || !week7Old.exists) {
      console.log('Old matchups not found');
      return;
    }

    const week2Data = week2Old.data();
    const week7Data = week7Old.data();

    // Richie's team ID is just "richie"
    const richieTeamId = 'richie';

    console.log('Using Richie team ID:', richieTeamId);

    // Create new matchups with correct data
    const week2New = {
      ...week2Data,
      team2: 'Richie',
      team2RosterId: richieTeamId
    };

    const week7New = {
      ...week7Data,
      team2: 'Richie',
      team2RosterId: richieTeamId
    };

    // Create new documents
    await db.collection('matchups').doc('2_aaron_richie').set(week2New);
    await db.collection('matchups').doc('7_aaron_richie').set(week7New);

    console.log('Created new matchups: 2_aaron_richie and 7_aaron_richie');

    // Delete old documents
    await db.collection('matchups').doc('2_aaron_pizza').delete();
    await db.collection('matchups').doc('7_aaron_pizza').delete();

    console.log('Deleted old matchups: 2_aaron_pizza and 7_aaron_pizza');
    console.log('Done!');

  } catch (error) {
    console.error('Error fixing matchups:', error);
  }

  process.exit();
}

fixMatchups();