const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const games = [
  // Week 1: Dec 30 - Jan 4
  { id: "401820639", date: "2025-12-30T19:00:00Z", week: 1, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820637", date: "2025-12-30T19:00:00Z", week: 1, homeId: 2390, homeName: "Miami Hurricanes", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820634", date: "2025-12-30T21:00:00Z", week: 1, homeId: 25, homeName: "California Golden Bears", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820635", date: "2025-12-30T21:00:00Z", week: 1, homeId: 24, homeName: "Stanford Cardinal", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820638", date: "2025-12-31T12:00:00Z", week: 1, homeId: 152, homeName: "NC State Wolfpack", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820641", date: "2025-12-31T14:00:00Z", week: 1, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820640", date: "2025-12-31T14:00:00Z", week: 1, homeId: 183, homeName: "Syracuse Orange", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820636", date: "2025-12-31T16:00:00Z", week: 1, homeId: 150, homeName: "Duke Blue Devils", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820643", date: "2026-01-02T20:00:00Z", week: 1, homeId: 24, homeName: "Stanford Cardinal", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820642", date: "2026-01-02T23:00:00Z", week: 1, homeId: 25, homeName: "California Golden Bears", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820646", date: "2026-01-03T11:00:00Z", week: 1, homeId: 152, homeName: "NC State Wolfpack", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820649", date: "2026-01-03T12:00:00Z", week: 1, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820647", date: "2026-01-03T12:00:00Z", week: 1, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820645", date: "2026-01-03T14:00:00Z", week: 1, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820648", date: "2026-01-03T14:15:00Z", week: 1, homeId: 2567, homeName: "SMU Mustangs", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820644", date: "2026-01-03T15:45:00Z", week: 1, homeId: 52, homeName: "Florida State Seminoles", awayId: 150, awayName: "Duke Blue Devils" },
  
  // Week 2: Jan 5-11
  { id: "401820650", date: "2026-01-06T19:00:00Z", week: 2, homeId: 97, homeName: "Louisville Cardinals", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820653", date: "2026-01-06T19:00:00Z", week: 2, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820651", date: "2026-01-06T21:00:00Z", week: 2, homeId: 103, homeName: "Boston College Eagles", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820656", date: "2026-01-07T19:00:00Z", week: 2, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820655", date: "2026-01-07T19:00:00Z", week: 2, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820654", date: "2026-01-07T21:00:00Z", week: 2, homeId: 258, homeName: "Virginia Cavaliers", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820652", date: "2026-01-07T21:00:00Z", week: 2, homeId: 228, homeName: "Clemson Tigers", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820659", date: "2026-01-10T12:00:00Z", week: 2, homeId: 97, homeName: "Louisville Cardinals", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820660", date: "2026-01-10T12:00:00Z", week: 2, homeId: 2390, homeName: "Miami Hurricanes", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820658", date: "2026-01-10T12:00:00Z", week: 2, homeId: 52, homeName: "Florida State Seminoles", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820657", date: "2026-01-10T14:00:00Z", week: 2, homeId: 150, homeName: "Duke Blue Devils", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820663", date: "2026-01-10T14:00:00Z", week: 2, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820664", date: "2026-01-10T14:15:00Z", week: 2, homeId: 258, homeName: "Virginia Cavaliers", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820665", date: "2026-01-10T16:00:00Z", week: 2, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820661", date: "2026-01-10T18:00:00Z", week: 2, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820662", date: "2026-01-10T18:00:00Z", week: 2, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 228, awayName: "Clemson Tigers" },
  
  // Week 3: Jan 12-18
  { id: "401820669", date: "2026-01-13T19:00:00Z", week: 3, homeId: 97, homeName: "Louisville Cardinals", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820670", date: "2026-01-13T19:00:00Z", week: 3, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820667", date: "2026-01-13T19:00:00Z", week: 3, homeId: 228, homeName: "Clemson Tigers", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820673", date: "2026-01-13T21:00:00Z", week: 3, homeId: 183, homeName: "Syracuse Orange", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820671", date: "2026-01-13T21:00:00Z", week: 3, homeId: 2567, homeName: "SMU Mustangs", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820668", date: "2026-01-14T19:00:00Z", week: 3, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820672", date: "2026-01-14T21:00:00Z", week: 3, homeId: 24, homeName: "Stanford Cardinal", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820666", date: "2026-01-14T23:00:00Z", week: 3, homeId: 25, homeName: "California Golden Bears", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820680", date: "2026-01-17T12:00:00Z", week: 3, homeId: 2567, homeName: "SMU Mustangs", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820682", date: "2026-01-17T12:00:00Z", week: 3, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820678", date: "2026-01-17T12:00:00Z", week: 3, homeId: 152, homeName: "NC State Wolfpack", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820674", date: "2026-01-17T14:00:00Z", week: 3, homeId: 103, homeName: "Boston College Eagles", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820676", date: "2026-01-17T14:15:00Z", week: 3, homeId: 228, homeName: "Clemson Tigers", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820675", date: "2026-01-17T16:00:00Z", week: 3, homeId: 25, homeName: "California Golden Bears", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820681", date: "2026-01-17T18:00:00Z", week: 3, homeId: 24, homeName: "Stanford Cardinal", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820677", date: "2026-01-17T18:00:00Z", week: 3, homeId: 52, homeName: "Florida State Seminoles", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820679", date: "2026-01-17T20:00:00Z", week: 3, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 97, awayName: "Louisville Cardinals" },
  
  // Week 4: Jan 19-25
  { id: "401820686", date: "2026-01-20T19:00:00Z", week: 4, homeId: 2390, homeName: "Miami Hurricanes", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820685", date: "2026-01-20T19:00:00Z", week: 4, homeId: 228, homeName: "Clemson Tigers", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820683", date: "2026-01-20T21:00:00Z", week: 4, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820687", date: "2026-01-21T19:00:00Z", week: 4, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820684", date: "2026-01-21T19:00:00Z", week: 4, homeId: 103, homeName: "Boston College Eagles", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820688", date: "2026-01-21T21:00:00Z", week: 4, homeId: 183, homeName: "Syracuse Orange", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820697", date: "2026-01-24T00:00:00Z", week: 4, homeId: 258, homeName: "Virginia Cavaliers", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820693", date: "2026-01-24T12:00:00Z", week: 4, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820690", date: "2026-01-24T12:00:00Z", week: 4, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820696", date: "2026-01-24T14:00:00Z", week: 4, homeId: 183, homeName: "Syracuse Orange", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820691", date: "2026-01-24T15:30:00Z", week: 4, homeId: 97, homeName: "Louisville Cardinals", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820694", date: "2026-01-24T16:00:00Z", week: 4, homeId: 2567, homeName: "SMU Mustangs", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820689", date: "2026-01-24T17:45:00Z", week: 4, homeId: 150, homeName: "Duke Blue Devils", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820692", date: "2026-01-24T18:00:00Z", week: 4, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820695", date: "2026-01-24T20:00:00Z", week: 4, homeId: 24, homeName: "Stanford Cardinal", awayId: 25, awayName: "California Golden Bears" },
  
  // Week 5: Jan 26 - Feb 1
  { id: "401820698", date: "2026-01-26T19:00:00Z", week: 5, homeId: 150, homeName: "Duke Blue Devils", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820704", date: "2026-01-27T18:00:00Z", week: 5, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820703", date: "2026-01-27T19:00:00Z", week: 5, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820702", date: "2026-01-27T19:00:00Z", week: 5, homeId: 152, homeName: "NC State Wolfpack", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820699", date: "2026-01-27T20:00:00Z", week: 5, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820700", date: "2026-01-28T19:00:00Z", week: 5, homeId: 52, homeName: "Florida State Seminoles", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820701", date: "2026-01-28T21:00:00Z", week: 5, homeId: 2390, homeName: "Miami Hurricanes", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820712", date: "2026-01-31T12:00:00Z", week: 5, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820707", date: "2026-01-31T12:00:00Z", week: 5, homeId: 228, homeName: "Clemson Tigers", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820705", date: "2026-01-31T13:30:00Z", week: 5, homeId: 103, homeName: "Boston College Eagles", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820709", date: "2026-01-31T14:00:00Z", week: 5, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820710", date: "2026-01-31T14:00:00Z", week: 5, homeId: 97, homeName: "Louisville Cardinals", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820713", date: "2026-01-31T15:45:00Z", week: 5, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820711", date: "2026-01-31T16:00:00Z", week: 5, homeId: 2390, homeName: "Miami Hurricanes", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820708", date: "2026-01-31T18:00:00Z", week: 5, homeId: 52, homeName: "Florida State Seminoles", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820706", date: "2026-01-31T18:00:00Z", week: 5, homeId: 183, homeName: "Syracuse Orange", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  
  // Week 6: Feb 2-8
  { id: "401820714", date: "2026-02-02T19:00:00Z", week: 6, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820715", date: "2026-02-03T19:00:00Z", week: 6, homeId: 150, homeName: "Duke Blue Devils", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820716", date: "2026-02-03T21:00:00Z", week: 6, homeId: 258, homeName: "Virginia Cavaliers", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820719", date: "2026-02-03T21:00:00Z", week: 6, homeId: 2567, homeName: "SMU Mustangs", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820718", date: "2026-02-04T19:00:00Z", week: 6, homeId: 97, homeName: "Louisville Cardinals", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820717", date: "2026-02-04T20:00:00Z", week: 6, homeId: 25, homeName: "California Golden Bears", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820720", date: "2026-02-04T22:00:00Z", week: 6, homeId: 24, homeName: "Stanford Cardinal", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820729", date: "2026-02-07T12:00:00Z", week: 6, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820728", date: "2026-02-07T12:00:00Z", week: 6, homeId: 258, homeName: "Virginia Cavaliers", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820723", date: "2026-02-07T13:30:00Z", week: 6, homeId: 152, homeName: "NC State Wolfpack", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820721", date: "2026-02-07T14:00:00Z", week: 6, homeId: 103, homeName: "Boston College Eagles", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820726", date: "2026-02-07T15:45:00Z", week: 6, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820725", date: "2026-02-07T16:00:00Z", week: 6, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820724", date: "2026-02-07T18:30:00Z", week: 6, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820727", date: "2026-02-07T20:00:00Z", week: 6, homeId: 24, homeName: "Stanford Cardinal", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820722", date: "2026-02-07T20:00:00Z", week: 6, homeId: 25, homeName: "California Golden Bears", awayId: 228, awayName: "Clemson Tigers" },
  
  // Week 7: Feb 9-15
  { id: "401820730", date: "2026-02-09T19:00:00Z", week: 7, homeId: 97, homeName: "Louisville Cardinals", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820731", date: "2026-02-10T19:00:00Z", week: 7, homeId: 2390, homeName: "Miami Hurricanes", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820734", date: "2026-02-10T19:00:00Z", week: 7, homeId: 52, homeName: "Florida State Seminoles", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820737", date: "2026-02-10T19:00:00Z", week: 7, homeId: 2567, homeName: "SMU Mustangs", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820736", date: "2026-02-10T21:00:00Z", week: 7, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820738", date: "2026-02-11T19:00:00Z", week: 7, homeId: 183, homeName: "Syracuse Orange", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820733", date: "2026-02-11T19:00:00Z", week: 7, homeId: 228, homeName: "Clemson Tigers", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820735", date: "2026-02-11T21:00:00Z", week: 7, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820732", date: "2026-02-11T21:00:00Z", week: 7, homeId: 103, homeName: "Boston College Eagles", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820740", date: "2026-02-14T12:00:00Z", week: 7, homeId: 150, homeName: "Duke Blue Devils", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820743", date: "2026-02-14T12:00:00Z", week: 7, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820739", date: "2026-02-14T12:00:00Z", week: 7, homeId: 103, homeName: "Boston College Eagles", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820742", date: "2026-02-14T14:00:00Z", week: 7, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820745", date: "2026-02-14T14:00:00Z", week: 7, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820744", date: "2026-02-14T14:00:00Z", week: 7, homeId: 183, homeName: "Syracuse Orange", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401817250", date: "2026-02-14T16:00:00Z", week: 7, homeId: 239, homeName: "Baylor Bears", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820746", date: "2026-02-14T16:00:00Z", week: 7, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820741", date: "2026-02-14T16:00:00Z", week: 7, homeId: 152, homeName: "NC State Wolfpack", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401817516", date: "2026-02-14T20:00:00Z", week: 7, homeId: 194, homeName: "Ohio State Buckeyes", awayId: 258, awayName: "Virginia Cavaliers" },
  
  // Week 8: Feb 16-22
  { id: "401820747", date: "2026-02-16T19:00:00Z", week: 8, homeId: 150, homeName: "Duke Blue Devils", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820748", date: "2026-02-17T18:00:00Z", week: 8, homeId: 52, homeName: "Florida State Seminoles", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820752", date: "2026-02-17T19:00:00Z", week: 8, homeId: 152, homeName: "NC State Wolfpack", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820749", date: "2026-02-17T19:00:00Z", week: 8, homeId: 2567, homeName: "SMU Mustangs", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820751", date: "2026-02-17T20:00:00Z", week: 8, homeId: 2390, homeName: "Miami Hurricanes", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820753", date: "2026-02-18T19:00:00Z", week: 8, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820750", date: "2026-02-18T21:00:00Z", week: 8, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820761", date: "2026-02-21T12:00:00Z", week: 8, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820755", date: "2026-02-21T12:00:00Z", week: 8, homeId: 228, homeName: "Clemson Tigers", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820759", date: "2026-02-21T13:00:00Z", week: 8, homeId: 183, homeName: "Syracuse Orange", awayId: 153, awayName: "North Carolina Tar Heels" },
  { id: "401820760", date: "2026-02-21T14:00:00Z", week: 8, homeId: 258, homeName: "Virginia Cavaliers", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820757", date: "2026-02-21T14:00:00Z", week: 8, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820756", date: "2026-02-21T14:15:00Z", week: 8, homeId: 97, homeName: "Louisville Cardinals", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820758", date: "2026-02-21T16:00:00Z", week: 8, homeId: 2567, homeName: "SMU Mustangs", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820754", date: "2026-02-21T18:00:00Z", week: 8, homeId: 25, homeName: "California Golden Bears", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401817238", date: "2026-02-21T18:30:00Z", week: 8, homeId: 150, homeName: "Duke Blue Devils", awayId: 130, awayName: "Michigan Wolverines" },
  
  // Week 9: Feb 23 - Mar 1 (PLAYOFFS - games TBD based on standings)
  { id: "401820762", date: "2026-02-23T19:00:00Z", week: 9, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820767", date: "2026-02-24T19:00:00Z", week: 9, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820763", date: "2026-02-24T19:00:00Z", week: 9, homeId: 258, homeName: "Virginia Cavaliers", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820764", date: "2026-02-24T19:00:00Z", week: 9, homeId: 103, homeName: "Boston College Eagles", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820766", date: "2026-02-24T21:00:00Z", week: 9, homeId: 52, homeName: "Florida State Seminoles", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820768", date: "2026-02-25T20:00:00Z", week: 9, homeId: 24, homeName: "Stanford Cardinal", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820765", date: "2026-02-25T22:00:00Z", week: 9, homeId: 25, homeName: "California Golden Bears", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820774", date: "2026-02-28T00:00:00Z", week: 9, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820770", date: "2026-02-28T00:00:00Z", week: 9, homeId: 228, homeName: "Clemson Tigers", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820771", date: "2026-02-28T12:00:00Z", week: 9, homeId: 150, homeName: "Duke Blue Devils", awayId: 258, awayName: "Virginia Cavaliers" },
  { id: "401820775", date: "2026-02-28T12:00:00Z", week: 9, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 152, awayName: "NC State Wolfpack" },
  { id: "401820772", date: "2026-02-28T12:00:00Z", week: 9, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820773", date: "2026-02-28T14:00:00Z", week: 9, homeId: 2390, homeName: "Miami Hurricanes", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820769", date: "2026-02-28T16:00:00Z", week: 9, homeId: 25, homeName: "California Golden Bears", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820777", date: "2026-02-28T17:45:00Z", week: 9, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820776", date: "2026-02-28T18:00:00Z", week: 9, homeId: 24, homeName: "Stanford Cardinal", awayId: 2567, awayName: "SMU Mustangs" },
  
  // Week 10: Mar 2-8 (PLAYOFFS - games TBD based on standings)
  { id: "401820778", date: "2026-03-02T19:00:00Z", week: 10, homeId: 152, homeName: "NC State Wolfpack", awayId: 150, awayName: "Duke Blue Devils" },
  { id: "401820779", date: "2026-03-03T19:00:00Z", week: 10, homeId: 153, homeName: "North Carolina Tar Heels", awayId: 228, awayName: "Clemson Tigers" },
  { id: "401820785", date: "2026-03-03T19:00:00Z", week: 10, homeId: 258, homeName: "Virginia Cavaliers", awayId: 154, awayName: "Wake Forest Demon Deacons" },
  { id: "401820781", date: "2026-03-03T21:00:00Z", week: 10, homeId: 97, homeName: "Louisville Cardinals", awayId: 183, awayName: "Syracuse Orange" },
  { id: "401820786", date: "2026-03-03T21:00:00Z", week: 10, homeId: 259, homeName: "Virginia Tech Hokies", awayId: 103, awayName: "Boston College Eagles" },
  { id: "401820784", date: "2026-03-04T19:00:00Z", week: 10, homeId: 2567, homeName: "SMU Mustangs", awayId: 2390, awayName: "Miami Hurricanes" },
  { id: "401820780", date: "2026-03-04T19:00:00Z", week: 10, homeId: 59, homeName: "Georgia Tech Yellow Jackets", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820783", date: "2026-03-04T21:00:00Z", week: 10, homeId: 221, homeName: "Pittsburgh Panthers", awayId: 52, awayName: "Florida State Seminoles" },
  { id: "401820782", date: "2026-03-04T21:00:00Z", week: 10, homeId: 87, homeName: "Notre Dame Fighting Irish", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820793", date: "2026-03-07T12:00:00Z", week: 10, homeId: 103, homeName: "Boston College Eagles", awayId: 87, awayName: "Notre Dame Fighting Irish" },
  { id: "401820787", date: "2026-03-07T12:00:00Z", week: 10, homeId: 228, homeName: "Clemson Tigers", awayId: 59, awayName: "Georgia Tech Yellow Jackets" },
  { id: "401820794", date: "2026-03-07T12:30:00Z", week: 10, homeId: 258, homeName: "Virginia Cavaliers", awayId: 259, awayName: "Virginia Tech Hokies" },
  { id: "401820790", date: "2026-03-07T14:00:00Z", week: 10, homeId: 2390, homeName: "Miami Hurricanes", awayId: 97, awayName: "Louisville Cardinals" },
  { id: "401820789", date: "2026-03-07T14:00:00Z", week: 10, homeId: 52, homeName: "Florida State Seminoles", awayId: 2567, awayName: "SMU Mustangs" },
  { id: "401820791", date: "2026-03-07T14:45:00Z", week: 10, homeId: 152, homeName: "NC State Wolfpack", awayId: 24, awayName: "Stanford Cardinal" },
  { id: "401820795", date: "2026-03-07T16:00:00Z", week: 10, homeId: 154, homeName: "Wake Forest Demon Deacons", awayId: 25, awayName: "California Golden Bears" },
  { id: "401820792", date: "2026-03-07T17:00:00Z", week: 10, homeId: 183, homeName: "Syracuse Orange", awayId: 221, awayName: "Pittsburgh Panthers" },
  { id: "401820788", date: "2026-03-07T18:30:00Z", week: 10, homeId: 150, homeName: "Duke Blue Devils", awayId: 153, awayName: "North Carolina Tar Heels" }
];

async function loadGames() {
  console.log(`Loading ${games.length} games to Firebase...\n`);
  
  const batchSize = 500;
  let uploaded = 0;
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = db.batch();
    const batchGames = games.slice(i, i + batchSize);
    
    batchGames.forEach(game => {
      const docRef = db.collection('games').doc(game.id);
      batch.set(docRef, {
        gameId: game.id,
        date: game.date,
        week: game.week,
        homeTeamId: game.homeId,
        homeTeamName: game.homeName,
        awayTeamId: game.awayId,
        awayTeamName: game.awayName,
        completed: new Date(game.date) < new Date(),
        scraped: false
      });
    });
    
    await batch.commit();
    uploaded += batchGames.length;
    console.log(`  Uploaded ${uploaded}/${games.length} games...`);
  }
  
  // Summary by week
  const weekSummary = games.reduce((acc, game) => {
    acc[game.week] = (acc[game.week] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`\n✓ Successfully loaded ${games.length} games to Firebase`);
  console.log('\nGames per week:');
  for (let week = 1; week <= 10; week++) {
    const label = week >= 9 ? `  Week ${week} (PLAYOFFS): ${weekSummary[week]} games` : `  Week ${week}: ${weekSummary[week]} games`;
    console.log(label);
  }
}

loadGames()
  .then(() => {
    console.log('\n✓ Game loading complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error loading games:', error);
    process.exit(1);
  });