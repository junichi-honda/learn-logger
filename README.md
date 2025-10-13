# Learn Logger

[![Language: Japanese](https://img.shields.io/badge/lang-ja-red.svg)](README.ja.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*Read this in other languages: [日本語](README.ja.md)*

A Slack app for tracking learning progress and comparing it against elapsed time.

## Overview

This Slack automation app helps you track your learning progress by recording completion percentages and comparing them with elapsed time to keep you on track with your goals.

## Features

- Record learning progress (%) through an interactive form
- Automatically calculate elapsed days (from April 1, 2025)
- Compare progress rate vs. time elapsed (total: 129 days)
- Display evaluation messages based on progress comparison
- Persistent data storage using Slack datastores

## Prerequisites

- [Slack CLI](https://api.slack.com/automation/cli) installed and configured
- Slack workspace with a paid plan
- Deno runtime environment

## Quick Start

### Installation

```bash
# Clone this project
git clone https://github.com/your-repo/learn-logger.git

# Change into the project directory
cd learn-logger
```

### Running Locally

Run the app locally with real-time updates:

```bash
# Start the local development server
slack run
```

Your app will have `(local)` appended to its name. Press `<CTRL> + C` to stop.

### Create a Trigger

To use the app, create a trigger manually:

```bash
slack trigger create --trigger-def triggers/sample_trigger.ts
```

This will generate a Shortcut URL. Click the link in Slack to launch the app.

### Deploying to Production

Deploy to Slack infrastructure:

```bash
slack deploy
```

After deployment, create a new trigger for the production version.

## Configuration

### Environment Variables

No environment variables are required for basic functionality.

### Secrets

Authentication is managed automatically through the Slack CLI.

## Project Structure

```
learn-logger/
├── datastores/          # Datastore definitions for persistent storage
│   └── sample_datastore.ts
├── functions/           # Business logic functions
│   └── sample_function.ts
├── triggers/            # Workflow trigger definitions
│   └── sample_trigger.ts
├── workflows/           # Workflow definitions
│   └── sample_workflow.ts
├── assets/              # Static assets
│   └── default_new_app_icon.png
├── manifest.ts          # App manifest with configuration
├── slack.json           # SDK dependencies
├── deno.jsonc           # Deno configuration
└── import_map.json      # Import mappings
```

### Key Components

- **Datastores**: Store learning progress data securely on Slack infrastructure
- **Functions**: Calculate progress rates and elapsed time percentages
- **Workflows**: Handle user input and orchestrate function execution
- **Triggers**: Define when and how workflows are invoked

## Testing

Run tests using Deno:

```bash
deno test
```

Or use the configured task:

```bash
deno task test
```

This will run formatting checks, linting, and tests.

## Usage

1. Click the Shortcut URL in Slack to launch the app
2. Enter your learning progress (%) in the form
3. Submit the form
4. View the comparison message showing:
   - Your progress percentage
   - Elapsed time percentage
   - Evaluation message

## How It Works

The app calculates:
- **Elapsed Days**: Days from April 1, 2025 to today
- **Time Ratio**: Elapsed days / 129 total days
- **Progress Comparison**: Your progress % vs. time ratio

You'll receive feedback on whether you're ahead of schedule or need to catch up.

## Datastore Scopes

This app requires the following scopes:
- `datastore:read` - Read stored learning progress
- `datastore:write` - Save new learning progress entries
- `commands` - Handle slash commands
- `chat:write` - Send messages
- `chat:write.public` - Send messages in public channels

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Resources

- [Slack Automation Platform](https://api.slack.com/automation)
- [Deno Slack SDK Documentation](https://api.slack.com/automation/quickstart)
- [Datastores Guide](https://api.slack.com/automation/datastores)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Created by**: jhonda  
**Repository**: [learn-logger](https://github.com/jhonda/repository/learn-logger)

