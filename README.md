# Learn Logger

[![Language: Japanese](https://img.shields.io/badge/lang-ja-red.svg)](README.ja.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*Read this in other languages: [日本語](README.ja.md)*

A Slack app for tracking learning progress per subject and comparing it against elapsed time in a semester.

## Overview

This Slack automation app helps you manage semesters, register subjects with credits, record per-subject progress percentages, and compare them with elapsed time to keep you on track with your goals.

## Features

- Create and manage semesters (year, season, start/end dates)
- Register subjects with credit weights per semester
- Record per-subject learning progress (%) through interactive modals
- View all subjects' progress with weighted average calculation
- Compare progress rate vs. elapsed time with visual progress bars
- Close semesters with a final summary report

## Prerequisites

- [Slack CLI](https://api.slack.com/automation/cli) installed and configured
- Slack workspace with a paid plan
- Deno runtime environment

## Quick Start

### Installation

```bash
# Clone this project
git clone https://github.com/jhonda/learn-logger.git

# Change into the project directory
cd learn-logger
```

### Running Locally

```bash
slack run
```

Your app will have `(local)` appended to its name. Press `<CTRL> + C` to stop.

### Create Triggers

Create triggers for each workflow:

```bash
slack trigger create --trigger-def triggers/semester_setup_trigger.ts
slack trigger create --trigger-def triggers/subject_setup_trigger.ts
slack trigger create --trigger-def triggers/log_progress_trigger.ts
slack trigger create --trigger-def triggers/view_progress_trigger.ts
slack trigger create --trigger-def triggers/semester_close_trigger.ts
```

Each command generates a Shortcut URL. Share the links in Slack to use the app.

### Deploying to Production

```bash
slack deploy
```

After deployment, create new triggers for the production version.

## Project Structure

```
learn-logger/
├── datastores/
│   ├── semesters_datastore.ts   # Semester records (year, season, dates, status)
│   ├── subjects_datastore.ts    # Subject records (name, credits, semester)
│   └── progress_datastore.ts    # Per-subject progress (%, updated_at)
├── functions/
│   ├── create_semester_function.ts  # Create a new semester
│   ├── add_subject_function.ts      # Add a subject to active semester
│   ├── log_progress_function.ts     # Record progress via modal
│   ├── view_progress_function.ts    # View all subjects' progress
│   └── close_semester_function.ts   # Close active semester
├── workflows/
│   ├── semester_setup_workflow.ts
│   ├── subject_setup_workflow.ts
│   ├── log_progress_workflow.ts
│   ├── view_progress_workflow.ts
│   └── semester_close_workflow.ts
├── triggers/
│   ├── semester_setup_trigger.ts
│   ├── subject_setup_trigger.ts
│   ├── log_progress_trigger.ts
│   ├── view_progress_trigger.ts
│   └── semester_close_trigger.ts
├── assets/
│   └── default_new_app_icon.png
├── manifest.ts          # App manifest
├── slack.json           # SDK dependencies
└── deno.jsonc           # Deno configuration
```

## Usage

1. **Create a semester** — Register year, season (spring/fall), start and end dates
2. **Add subjects** — Register subjects with credit counts to the active semester
3. **Log progress** — Select a subject and enter progress (0-100%)
4. **View progress** — See all subjects with progress bars and weighted average
5. **Close semester** — End the active semester with a final report

## How It Works

- **Elapsed time rate**: Calculates `(today - start_date) / (end_date - start_date) * 100` in JST
- **Progress comparison**: Shows the difference between your progress and elapsed time
- **Weighted average**: Uses credit counts to calculate overall progress across subjects
- **Visual feedback**: Progress bars and status indicators (ahead / on track / behind)

## Bot Scopes

- `datastore:read` — Read stored data
- `datastore:write` — Save data
- `commands` — Handle slash commands
- `chat:write` — Send messages
- `chat:write.public` — Send messages in public channels

## Testing

```bash
deno task test
```

## License

MIT License — see the [LICENSE](LICENSE) file for details.

## Resources

- [Slack Automation Platform](https://api.slack.com/automation)
- [Deno Slack SDK Documentation](https://api.slack.com/automation/quickstart)
- [Datastores Guide](https://api.slack.com/automation/datastores)
