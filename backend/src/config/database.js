const { Sequelize } = require('sequelize');
const { config } = require('./env');

const sequelize = new Sequelize(
  config.DB_NAME,
  config.DB_USER,
  config.DB_PASSWORD,
  {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: false,      // PRD tables have no created/updated columns
      freezeTableName: true,  // use exact table names from schema.sql
    },
  }
);

module.exports = sequelize;
