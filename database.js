require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Set up the Sequelize instance to connect to your PostgreSQL database
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false, // Set to console.log to see the raw SQL queries
});

// Define the TradeLog model for the `trade_logs` table
const TradeLog = sequelize.define('TradeLog', {
    symbol: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    side: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
    }
}, {
    tableName: 'trade_logs',
    timestamps: false, // Disable automatic timestamps for createdAt and updatedAt
});

// Sync the model with the database (creates the table if it doesn't exist)
async function initDB() {
    try {
        await sequelize.authenticate();
        console.log('Connection to the PostgreSQL database has been established successfully.');
        await TradeLog.sync(); // Ensure the table is created
        console.log('TradeLog table has been synchronized.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

initDB();

module.exports = TradeLog;
