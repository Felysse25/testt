# How to add my content

Put your files in the folders below, then edit `exhibition/content.js` in a plain-text editor. Paths are relative to the project's `index.html`. Use exact capitalization and forward slashes. Start paths with `assets/` so they also work under a GitHub Pages repository URL.

| Content | Folder | Edit in `exhibition/content.js` |
| --- | --- | --- |
| Food photographs | `assets/photos/` | The matching dish's `photos` array |
| Welcome video | `assets/videos/` | `stations.welcome.video` |
| Optional dish videos | `assets/videos/` | The matching dish's `video` |
| Interview recordings | `assets/interviews/` | `stations.interviews.interviews`, in the matching speaker's `video` |
| Final survey infographic | `assets/survey/` | `stations.research.infographic.path` and `alt` |

## Food photographs

Find the dish by its name, such as `Sinigang`, then replace its `photos` list with a list like this. Use JPG, PNG, or WebP. Add another object for each photograph. Include descriptive alt text and a credit where appropriate.

```js
photos: [
  {path: 'assets/photos/sinigang.webp', alt: 'A bowl of Sinigang', credit: 'Photograph by [name]'}
],
```

The exhibition displays the credited photos in the dish panel. Set its `photos` list to `[]` to hide that panel section.

## Welcome video and interviews

Use MP4 with H.264 video and AAC audio for broad browser support. Fill in the relevant `video` field. Myeisha Alvez’s path is already configured. Copy her MP4 to `assets/interviews/myeisha-alvez.mp4`. The player displays standard controls once the video loads.

```js
// Inside stations.welcome
video: 'assets/videos/welcome.mp4',

// In the Senior Vice President entry
video: 'assets/interviews/senior-vp.mp4',

// In the Myeisha Alvez entry
video: 'assets/interviews/myeisha-alvez.mp4',
```

## Final survey infographic

Find `stations.research.infographic`. Set the path to a JPG, PNG, WebP, or PDF. For images, write alt text that describes the real infographic. You can add verified text findings separately in `additionalFindings`.

```js
infographic: {path: 'assets/survey/final-survey.webp', alt: 'Final survey infographic'},
```

For a PDF, use a path such as `assets/survey/final-survey.pdf`. Once the site can confirm the file is available, the research panel links to it in a new tab. To test PDFs locally, serve the project over HTTP as shown below.

## Preview and publish

Leave unknown media paths blank until content is ready. The exhibition displays placeholders for blank or unavailable media. Keep the `.gitkeep` files if you want Git to retain empty folders.

For the most reliable local preview, open a terminal in the folder containing `index.html` and run `python -m http.server 8000`. Then open `http://localhost:8000/` in your browser. Check each edited panel before publishing.

Publish the full project with the `app`, `exhibition`, and `assets` folders alongside `index.html`. Commit your new media files and the updated `content.js` together, then check the GitHub Pages URL after deployment.
