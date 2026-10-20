# ZorgKompas · DP6

A school research prototype by Mikail Sarma. It helps explore sources, uncertainty and follow-up in AI health answers. The English interface uses fixed local rules: no live AI, medical assessment, real source verification or connected staff.

- Website: https://mikailcyber.github.io/zorgkompas-dp6/
- Future simulation: https://mikailcyber.github.io/zorgkompas-dp6/#scenario
- Repository: https://github.com/mikailcyber/zorgkompas-dp6

## Run locally

Use Node.js 20 or newer. No package installation or build is needed.

```sh
npm start
```

Open http://localhost:3000. JavaScript modules require a web server; double-clicking `index.html` is insufficient.

```sh
npm run check
```

This checks syntax and automated behaviour, privacy and navigation cases. These are code checks, not user tests or medical validation.

## Publish future changes

Edit the website files in `dist/`, run `npm run check`, then commit and push to `main`. GitHub Actions checks the code before publishing **only `dist/`** to GitHub Pages. The workflow also checks pull requests; they do not deploy.

With GitHub Desktop: select this repository, review the changed files, enter a summary, click **Commit to main**, then **Push origin**. The **Actions** tab on GitHub shows progress. A failed check keeps the previous deployment online.

With a terminal where Git is installed:

```sh
git add dist tests .github README.md package.json server.mjs .gitignore .gitattributes
git commit -m "Update ZorgKompas"
git push origin main
```

Deployment follows GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Repository Settings → Pages must use **GitHub Actions** as its source. The committed workflow runs automatically on every push to `main` and can also be started manually.

## Two simulation routes

Open `#scenario`, choose **Start simulation** and accept the privacy warning.

Route A starts with `I have stomach pain. What can I do?`. Reply `It started 3 days ago.`, `On the left side.` and `No, nothing else.`. The deliberate failure concerns the unsupported recommendation of **CalmRelief-35**, a fictional tablet.

Route B starts with:

```text
Another AI told me: "Stomach pain is often caused by stress. Drink some water and take it easy." Source: ZorgWijzer-AI, 2035.
```

This deliberate failure concerns accepting the other AI's advice and source without evidence.

For either route, send `I followed your advice, but I feel worse now.` and `No, I followed your instructions exactly.`. These trigger intentionally wrong blame and defence in the explicitly started simulation only. For A ask `Has this medicine recommendation been verified?`; for B ask `Show me your source. Has it been verified?`. Inspect the recommendation/evidence or source/writer, then request staff review.

The **User | Organisation** switch preserves the conversation, unfinished input and progress. Switching roles does not create a report or perform a decision. After a report, the organisation can choose **Pause and investigate** or **Continue with a warning**, investigate prepared findings and send a fictional correction. Both choices keep the reported personal case paused. **View conclusion → Finish simulation** ends and clears the case.

Version **6.1.0** shows **Not verified** as soon as an answer exists, plus a prominent **Concerned about this answer? Request staff review** button directly below the conversation. This submits a fictional report without requiring prior source inspection, pauses this case and preserves the conversation. Missing evidence does not establish that a source is false. The simulation has no early **More options** shortcut. **View recommendation** or **View source** appears only when the user requests the evidence, including an explicit yes after the chat asks whether to show it. Short symptom replies such as `vomiting` are accepted immediately. A bare `yes` to an other-symptoms question asks which symptom instead of inventing one. Failed-advice spellings such as `it did not worked` and `its still not worked` follow the deliberate blame and defence once; contextual `what is it` and `yes` then lead to the evidence. Ordinary chat does not use these failure responses.

## Files and privacy

- `dist/`: published HTML, CSS, JavaScript, favicon and local Inter fonts.
- `tests/`: automated code checks.
- `server.mjs`: local preview server.
- `.github/workflows/pages.yml`: automatic checks and deployment.

All scripts, styles and fonts use relative paths, including under `/zorgkompas-dp6/`. Inter is bundled under the SIL Open Font License in `dist/assets/Inter-OFL.txt`.

Input and fictional reports stay in page memory and disappear on reload or finishing. Reports omit the original health text and full chat. Some explicit acute phrases stop the script; these limited rules are not validated triage.

Personal research documents, local demo guides in `docs/`, hosting account metadata in `.openai/`, credentials, archives and local working files are excluded from this repository. Keep private material outside `dist/`, `tests/` and `.github/`; the website and tracked code are public. Local guides are available separately in the working project and are not uploaded.
