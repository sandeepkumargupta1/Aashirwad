# Free Aashirwad assistant

The assistant is part of the website. Open **Ask Aashirwad** in the bottom-right corner. Type a request or tap the microphone and speak. English and Hindi follow the website’s selected language (`en-IN` and `hi-IN` for speech). The microphone never starts automatically and stops on close, language change, cancellation or timeout. Read-aloud replies use the device’s installed voices.

## What it can control

- Open the home, field, soil, historical weather, water, crops, advisory, comparison and source pages.
- Select Streets, Satellite or Terrain; request the current location; search a village and choose a numbered result.
- Change growing season, water category, field area and units, study radius, crop or farm name through the existing field validation.
- Read the current soil, weather, water, crop, irrigation and source summaries. Missing values remain unavailable; sample data is explicitly labeled.
- Open crop details, compare up to three crops, and filter seasonal or low-water crops.
- Open and fill soil-test drafts. Saving requires a review of values, units, laboratory and date, followed by explicit confirmation.
- Start, finish or clear a field boundary. Boundary corners are selected on the map; spoken requests cannot infer field boundaries.
- Adjust irrigation scenario inputs, refresh the current data mode, apply the selected field, and download a farm report or the source code.

Saved farm edits, applying a field, choosing a search result, saving a soil test and clearing a boundary show a review card. Press **Confirm changes**, say **confirm** / **पुष्टि करें**, or cancel. A change in the underlying form invalidates the old review. Voice can fill a value but cannot silently certify laboratory evidence.

## Try these requests

| English | Hindi |
| --- | --- |
| Show satellite view | उपग्रह वाला नक्शा दिखाओ |
| What is my soil pH? | मिट्टी का पीएच कितना है? |
| Read my rainfall | मेरी वर्षा की जानकारी पढ़ो |
| Which crops fit my field? | मेरे खेत के लिए कौन सी फसल ठीक है? |
| Change season to Kharif | मौसम खरीफ करो |
| Set field size to 5 hectares | खेत का आकार ५ हेक्टेयर रखो |
| Compare wheat and chickpea | गेहूँ और चना की तुलना करो |
| Search for Sehore | सीहोर गाँव खोजो |
| Show all 9 crops | सभी फसलें दिखाओ |
| Add soil test | मिट्टी की जाँच जोड़ें |

Simple commands and factual summaries work immediately. Free-text understanding is deliberately scoped to this application; it does not operate external accounts, run arbitrary JavaScript or create farm measurements.

## Optional on-device AI

Expand **More flexible questions with free AI**, then choose **Enable free on-device AI**. No AI API key, subscription, paid fallback or billing configuration is used. Qwen3-0.6B runs in a Web Worker on the visitor’s device through WebLLM. The first load downloads approximately 400 MB of model/runtime files, which the browser can cache. Supported WebGPU hardware, a secure browser context and approximately 2 GB of graphics memory are required. GPU support, storage limits, browser data clearing and provider download availability affect loading. Closing the assistant releases the model worker; cached files stay under the browser’s own storage controls.

The model infers only an allowed action. The action schema is enforced after inference, and all measurements in replies come from deterministic application data. The model cannot provide its own approval flag, execute arbitrary code, change hosting permissions, invent measurements or silently save a laboratory report. Unknown or invalid model output performs no action. Negated commands are ignored.

Typed commands and data summaries continue to work when the model is unavailable. No cloud model endpoint is configured. Browser speech recognition may use the browser provider’s online recognition service, and language/voice support varies by browser and operating system. Standard internet/data usage still applies; the feature itself has no metered AI API charges. No microphone recording is stored by this app, and conversation messages remain in memory for the current page.

## Welcome and sign-in

The first visit displays the animated welcome page. Returning to the dashboard in the same tab skips it; the sidebar profile link always opens `/login`. The page uses Sites’ native top-level ChatGPT sign-in links and the existing platform identity helper. It never accepts or stores a password. The hosted Site’s existing audience is preserved; its platform access gateway may appear before the branded page. The local/example dashboard is for exploring labeled sample data and does not establish an authenticated account.

## Sources and licenses

- [WebLLM documentation](https://webllm.mlc.ai/docs/) and [source](https://github.com/mlc-ai/web-llm): Apache 2.0.
- [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B): Apache 2.0; [MLC browser model](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC).
- [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API).
- The welcome illustration is original SVG/CSS with no external image or animation subscription.
- Design references: [Plantix](https://www.plantix.net/en/) and [DeHaat’s farmer app](https://agrevolution.in/solution-for-farmers), for clear farming tasks, crop imagery and accessible language choices. Their branding, assets and code are not reused.
