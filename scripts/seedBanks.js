// scripts/seedBanks.js
const mongoose = require('mongoose');
const Bank = require('../Model/Bank');
require('dotenv').config();

// US Banks data
const usaBanks = [
  { name: 'Bank of America', routingNumber: '026009593' },
  { name: 'Wells Fargo', routingNumber: '121000248' },
  { name: 'Chase Bank', routingNumber: '072000326' },
  { name: 'Citibank', routingNumber: '021000089' },
  { name: 'US Bank', routingNumber: '091000022' },
  { name: 'PNC Bank', routingNumber: '043000096' },
  { name: 'TD Bank', routingNumber: '031101266' },
  { name: 'Capital One', routingNumber: '051405515' },
  { name: 'Truist Bank', routingNumber: '053101121' },
  { name: 'HSBC Bank USA', routingNumber: '022000020' },
  { name: 'Fifth Third Bank', routingNumber: '042000314' },
  { name: 'Regions Bank', routingNumber: '062000019' },
  { name: 'Citizens Bank', routingNumber: '011500120' },
  { name: 'KeyBank', routingNumber: '041001039' },
  { name: 'Ally Bank', routingNumber: '124003116' },
  { name: 'SunTrust Bank', routingNumber: '061000104' },
  { name: 'Huntington National Bank', routingNumber: '044000024' },
  { name: 'First Republic Bank', routingNumber: '321081669' },
  { name: 'M&T Bank', routingNumber: '022000046' },
  { name: 'Santander Bank', routingNumber: '231372691' },
  { name: 'First National Bank', routingNumber: '043318092' },
  { name: 'Union Bank', routingNumber: '122000496' },
  { name: 'Bank of the West', routingNumber: '121100782' },
  { name: 'BMO Harris Bank', routingNumber: '071000288' },
  { name: 'Comerica Bank', routingNumber: '072000096' },
  { name: 'Charles Schwab Bank', routingNumber: '121202211' },
  { name: 'Discover Bank', routingNumber: '031100649' },
  { name: 'Zions Bank', routingNumber: '124000054' },
  { name: 'First Citizens Bank', routingNumber: '053100300' },
  { name: 'Synovus Bank', routingNumber: '061100606' },
  { name: 'Peoples United Bank', routingNumber: '221172186' },
  { name: 'Associated Bank', routingNumber: '075900575' },
  { name: 'Frost Bank', routingNumber: '114000093' },
  { name: 'CIBC Bank USA', routingNumber: '071006486' },
  { name: 'Valley National Bank', routingNumber: '021201383' },
  { name: 'East West Bank', routingNumber: '322070381' },
  { name: 'Hancock Whitney Bank', routingNumber: '065400153' },
  { name: 'First Horizon Bank', routingNumber: '084000026' },
  { name: 'Webster Bank', routingNumber: '211170101' },
  { name: 'Pinnacle Bank', routingNumber: '107005389' },
  { name: 'Investors Bank', routingNumber: '221272031' },
  { name: 'Umpqua Bank', routingNumber: '123205054' },
  { name: 'United Bank', routingNumber: '051504597' },
  { name: 'Washington Federal', routingNumber: '325070760' },
  { name: 'Cathay Bank', routingNumber: '122016066' },
  { name: 'Fulton Bank', routingNumber: '031301422' },
  { name: 'Eastern Bank', routingNumber: '011301798' },
  { name: 'Simmons Bank', routingNumber: '082900432' },
  { name: 'Old National Bank', routingNumber: '086300012' },
  { name: 'FirstBank', routingNumber: '107005047' }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    seedBanks();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const seedBanks = async () => {
  try {
    // Clear existing banks
    await Bank.deleteMany({});
    
    // Insert bank data
    const banks = usaBanks.map(bank => ({ 
      ...bank, 
      location: 'USA',
      active: true
    }));
    
    await Bank.insertMany(banks);
    
    console.log(`${banks.length} banks seeded successfully`);
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding banks:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};