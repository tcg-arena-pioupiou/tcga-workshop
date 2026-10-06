# TCG Arena Workshop

Every game on the workshop is described by a small `workshop.json` file that **you host yourself**, next to your game (GitHub Pages works great). You keep full control: change your file whenever you want, the workshop picks up your changes once a day.

## 1. Create your `workshop.json`

Put it anywhere online, ideally next to your game file. Copy this and fill it in (full example in [`examples`](examples)):

```json
{
    "author": "YourName",
    "gameUrl": "https://yourname.github.io/your-repo/Game.json",
    "tags": "tcg,fantasy",
    "langs": ["en"],
    "useAiArts": false,
    "screenshotUrls": [
        "https://yourname.github.io/your-repo/screenshots/1.png",
        "https://yourname.github.io/your-repo/screenshots/2.png"
    ],
    "descriptionUrl": "https://yourname.github.io/your-repo/description.md",
    "updates": ["First release!"]
}
```

| Field | Required | What to put |
|---|---|---|
| `author` | yes | The name displayed as the game's author. |
| `gameUrl` | yes | Full link to your game file. |
| `tags` | no | Words people can search for, separated by commas (max 200 characters). |
| `langs` | yes | Languages of your game, ex: `["en", "fr"]`. |
| `useAiArts` | yes | `true` or `false` (no quotes). |
| `screenshotUrls` | no | Full links to your screenshots. |
| `descriptionUrl` | no | Full link to a `.md` file with your description (you can use **bold**, lists, links…). |
| `updates` | no | Your patch notes, **newest first**. One text per update. For several lines, use a list of lines: `["Big update:", "- New cards", "- Bug fixes"]`. You can edit old ones anytime. |

**Always use full links** starting with `https://`, never a file name or a path like `screenshots/1.png`. Each link must open the file itself: on GitHub, use the **Raw** link or your GitHub Pages link, not the page of the file.

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
