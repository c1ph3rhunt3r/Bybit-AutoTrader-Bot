# Telegram Trading Bot

This Telegram bot automates trading activities on the Bybit exchange based on signals received from selected Telegram groups or manual inputs. It supports both manual and signal-based trading modes, allowing for flexible interaction.

## Features

- **Manual Mode**: Allows users to manually input trade details and execute trades via the bot.
- **Signal Mode**: Automatically detects and processes trading signals from selected Telegram groups, placing trades on Bybit.
- **Balance Checks**: Ensures sufficient balance before executing trades.
- **Customizable Settings**: Set leverage, quantity, stop-loss (SL), and take-profit (TP) levels.
- **Error Handling**: Notifies users of any issues such as insufficient balance or incomplete trade signals.
- **Low Balance Shutdown**: Automatically stops listening for signals when the balance is insufficient, notifying the user.

## Getting Started

### Prerequisites

- Node.js (v18.20.1 or higher)
- PostgreSQL
- Bybit API Key and Secret
- Telegram Bot Token

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/repo-name.git
   cd repo-name
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up your environment variables**:
   Create a `.env` file in the root directory and add your credentials:
   ```env
   BYBIT_API_KEY='your_bybit_api_key'
   BYBIT_API_SECRET='your_bybit_api_secret'
   TELEGRAM_TOKEN='your_telegram_bot_token'
   DATABASE_URL='postgresql://username:password@localhost/database_name'
   USER_ID='your_telegram_user_id'
   ```

4. **Set up PostgreSQL**:
   Make sure PostgreSQL is installed and running. Create a database and update the `DATABASE_URL` in your `.env` file with the appropriate connection string.

### Running the Bot

1. **Start the bot**:
   ```bash
   node bot.js
   ```

2. **Interacting with the bot**:
   - Use `/start` to begin using the bot and select a mode.
   - Use `/exitmode` to exit the current mode and return to the home screen.
   - Use `/help` to display available commands.
3. **Signal Format**:

      ![image](https://github.com/user-attachments/assets/f185cab7-9a68-4d09-98d5-f882b78d6730)

### Important Notes

- Ensure that your Bybit API key has the necessary permissions to execute trades.
- The bot will only respond to the user ID specified in the `.env` file for security reasons.

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request.
