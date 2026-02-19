import { defineConfig } from "vitepress";

const nav = [
  {
    "text": "Home",
    "link": "/"
  },
  {
    "text": "Recipes",
    "link": "/wiki/recipes/"
  }
];

const sidebar = [
  {
    "text": "Recipes",
    "items": [
      {
        "text": "Overview",
        "link": "/wiki/recipes/"
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
