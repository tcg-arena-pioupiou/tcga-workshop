# TCG Arena Workshop 

Every game on the workshop is described by a small `workshop.json` file that **you host yourself**, next to your game (GitHub Pages works great). You keep full control: change your file whenever you want, the workshop picks up your changes once a day.

## 1. Create your `workshop.json`

Put it anywhere online, ideally in the same folder as your game file. Copy this and fill it in (full example in [`.github/workshop/examples`](.github/workshop/examples)):

```json
{
    "author": "YourName",
    "contact": { "discord": "your_discord_name" },
    "gameUrl": "Game.json",
    "tags": "tcg,fantasy",
    "langs": ["en"],
    "useAiArts": false,
    "screenshotUrls": ["screenshots/1.png", "screenshots/2.png"],
    "descriptionUrl": "description.md",
    "updates": ["First release!"]
}
```

| Field | Required | What to put |
|---|---|---|
| `author` | yes | The name displayed as the game's author. |
| `gameUrl` | yes | Link to your game file. Can be just the file name if it's in the same folder. |
| `tags` | yes | Words people can search for, separated by commas (max 200 characters). Use `""` if none. |
| `langs` | yes | Languages of your game, ex: `["en", "fr"]`. |
| `useAiArts` | yes | `true` or `false` (no quotes). |
| `contact.discord` | no | Your Discord name, so we can reach you if something breaks. |
| `screenshotUrls` | no | Links or paths to screenshots. |
| `descriptionUrl` | no | Link or path to a `.md` file with your description (you can use **bold**, lists, links…). |
| `updates` | no | Your patch notes, **newest first**. One text per update. For several lines, use a list of lines: `["Big update:", "- New cards", "- Bug fixes"]`. You can edit old ones anytime. |

The game name and main image are read directly from your game file (`name` and `menuBackgroundImage`), so you don't need to repeat them here.

## 2. Register your game (once)

1. Open [`registry.json`](registry.json) and click the ✏️ pencil icon.
2. Go to the end of the list. After the last `}`, add a comma, then your entry:
   ```json
   ,
   {
       "name": "My Game",
       "workshopUrl": "https://yourname.github.io/your-repo/workshop.json"
   }
   ```
   The file must still end with `]`.
3. Click **Commit changes…** then **Propose changes**, then **Create pull request**.

A bot checks your file within a minute and leaves a comment. If something is wrong it tells you what, just edit your change and it checks again. Once accepted, your game appears on the workshop.

## 3. Updating your game

Nothing to do here! Edit your own `workshop.json` (or description, screenshots, game file). The workshop refreshes every day.
