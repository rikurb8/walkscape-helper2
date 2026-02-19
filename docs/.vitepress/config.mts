import { defineConfig } from "vitepress";

const nav = [
  {
    "text": "Home",
    "link": "/"
  },
  {
    "text": "Skills",
    "link": "/wiki/skills/"
  }
];

const sidebar = [
  {
    "text": "Skills",
    "items": [
      {
        "text": "Overview",
        "link": "/wiki/skills/"
      },
      {
        "text": "Agility",
        "link": "/wiki/skills/agility"
      },
      {
        "text": "Carpentry",
        "link": "/wiki/skills/carpentry"
      },
      {
        "text": "Cooking",
        "link": "/wiki/skills/cooking"
      },
      {
        "text": "Crafting",
        "link": "/wiki/skills/crafting"
      },
      {
        "text": "Fishing",
        "link": "/wiki/skills/fishing"
      },
      {
        "text": "Foraging",
        "link": "/wiki/skills/foraging"
      },
      {
        "text": "Mining",
        "link": "/wiki/skills/mining"
      },
      {
        "text": "Smithing",
        "link": "/wiki/skills/smithing"
      },
      {
        "text": "Trinketry",
        "link": "/wiki/skills/trinketry"
      },
      {
        "text": "Woodcutting",
        "link": "/wiki/skills/woodcutting"
      }
    ]
  }
];

export default defineConfig({
  title: "WalkScape Wiki Scraper",
  description: "Local validation viewer for scraped WalkScape markdown",
  cleanUrls: true,
  themeConfig: {
    nav,
    sidebar,
    search: {
      provider: "local"
    }
  }
});
