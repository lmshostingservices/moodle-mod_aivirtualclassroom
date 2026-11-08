# Changes

## 1.1.3 (2026112400)
- Background cut-out is back to the 1.1.1 settings (the 1.1.2 edge changes clipped ears).
- Studio look now does much more, still in one light graphics pass with no cut-out model: a portrait-lens look (the room around you goes softer, a little darker and calmer), a soft key light that follows your face, a touch of sharpening on you, auto exposure, white balance and a gentle film-style tone curve. When a background effect is on, the lens softening is left out so the cut-out edge stays clean.
- Bottom bar redesigned: smaller buttons in clear groups, left to right: You (mic with noise suppression, camera, share); Camera look (blur, background, smooth skin, studio look); Take part (hand, react, captions, present, view); Panels (chat, people, notes, Q&A, polls, breakouts); Settings (my name, data saver); Teacher (record); End and Leave. Under 1500 px wide the camera-look, settings and record buttons move into More; under 1180 px the panel buttons (except Chat) and End move there too.

## 1.1.2 (2026112300)
- Studio look is no longer a close-up: it frames you head-and-shoulders (about 5–20% zoom instead of up to 45%), and less again when a background is on. It only re-frames when you really move, and moves slowly, so the picture stops drifting.
- The bottom bar now has one-tap buttons for everything that was under the three dots: Blur, Background (pictures), Smooth skin, Studio look, Data saver, My name, and for teachers Record, Breakouts and End (end the meeting for everyone). Noise suppression is in the small arrow next to Mute. On smaller screens (under about 1180 px wide, tablets and phones) these fold back into a "More" menu so the bar stays tidy. The bar tightens on laptop screens so Leave is always visible.
- Cleaner cut-out in front of a background picture: the cut-out now runs on every camera frame (it used to run 15 times a second, so the real room showed around you when you moved), the edge is a little tighter, and the picture's colour and light are blended into your outline so you sit in the scene. Blur is unchanged.

## 1.1.1 (2026112200)
- Captions no longer mix up words between people. Fixes:
  - Only one recogniser writes the words: the accurate server one. The browser now only shows a "…" (someone is speaking) while the sentence is being recognised, instead of its own rougher words that were then replaced.
  - The recogniser's context is only the same speaker's previous sentence. Before, it was given the last sentence from anyone, and sometimes repeated or blended it into the next person's caption.
  - A translated voice read aloud on a listener's computer is no longer picked up by their microphone and captioned as their own speech (and the same sentence heard back from another person is dropped).
  - Speech is sent from the exact tab that recorded it, so a person with two tabs open gets the right name on their captions.
  - A late translation updates its own sentence and never pulls the caption back to someone who has finished.
  - The caption stays with a speaker until their sentence (and its translation) has been on screen for a moment, then moves to the next speaker.

## 1.1.0 (2026112100)
- New **Studio look** (replaces "Studio quality"): better lighting (auto brightness, natural colour, lifted shadows, a soft key light) and auto framing that keeps you centred and slightly zoomed in, following your face smoothly. One light graphics pass plus a tiny face finder on the processor, so it works on ordinary computers. Turn it on from the join screen or More. If the face finder cannot load, it centres and zooms in a little.
- The old hair-level cut-out model (WebGPU) is removed. It could reset the graphics chip on some computers.
- Changing background, blur, smooth skin or Studio look no longer freezes your video: anything slow loads first while your current picture keeps playing, then the new one swaps in.
- Uploading your own background picture is much faster: the photo is shrunk and encoded in the background instead of freezing the page.
- Teachers see the class link in the top bar with a Copy button (and Guest link when guests are allowed).

## 1.0.1 (2026112001)
- Pictures shared with Present are shrunk to at most 2560 px before upload (a 10 MB phone photo becomes about 0.5-1 MB), so the class no longer lags when a picture is shown. Pictures are decoded in the background.
- Smoother background blur: the blur now runs on the graphics chip instead of the processor, and the person cut-out runs about 15 times a second (smoothed in between) while the video itself stays at full frame rate. Standard effects no longer switch to the slower processor mode after a studio-quality problem.
- Background > Studio quality now says why it is unavailable: browser without WebGPU, software-only graphics, too slow on this computer, or stopped after a graphics reset.

## 1.0 (2026112000)
- First stable release of AI Virtual Classroom. Includes everything from 0.9.1.
- A site that owes LMS Labs credits, or has none left, cannot start a new class until it tops up (a class that is running is never cut off).

## 0.9.1 (2026111901)
- Captions show one person at a time: the person speaking now, in one steady box that never moves, resizes or redraws. When someone else starts talking (after a short pause), the same box switches to them.
- You no longer see captions of your own voice; everyone else still does.
- No more flicker: the caption box is built once and only its words change.

## 0.9.0 (2026111900)
- Ten office backgrounds: open-plan, executive, home office, brick loft, library, plant wall, city view, creative studio, beach office and training room. Each is shot as the wall behind you, so you sit naturally in front of it. They ship inside the plugin.
- Your picture in class: on the join screen, take a photo, upload one or pick one of twelve fun avatars. It shows on your tile, in People and next to your captions. Your Moodle profile picture is not changed.
- Captions are easier to follow: each speaker gets their own colour, picture and name, and their words grow smoothly in one bubble instead of flickering. Up to two speakers show at once.
- Translated voice: new "Hear only the translated voice" option mutes speakers of another language, so you hear only the translation. Speakers of your own language stay on.
- No more frozen video when you switch to another tab or window: camera effects keep running in the background, and other people's video keeps playing on a light layer, then returns to full quality the moment you come back.
- AI quiz: "Paste your own text" as a third source, alongside the slides on screen and a file.
- Pictures, PDFs and slides now always fit below the toolbar instead of covering it.

## 0.8.3 (2026111803)
- Camera effects can no longer take the class page down. If studio quality, a background or smooth skin stops (graphics reset, model error or a slow computer), your plain camera keeps going straight away, the effect's graphics memory is released, and after a short pause the class tries one step down (studio quality, then standard, then none). Three failures in one class turn effects off for that class; your saved choice is kept for next time.
- If a page ever closes unexpectedly while studio quality is running, studio quality is switched off the next time you open the class, with a message, so it can't happen twice.
- Switching backgrounds, blur, studio quality and smooth skin on and off now frees graphics memory each time instead of building it up.
- After a graphics failure the person cut-out runs on the processor instead of the graphics chip.

## 0.8.2 (2026111802)
- AI quiz maker: tidier "Make it from" choices and price label.
- Quiz titles made from file names read naturally ("Leading teams" instead of "leading-teams").

## 0.8.1 (2026111801)
- Fixed: presenting PowerPoint, Word and Excel files failed after the rename.
- Tested on Moodle 4.5, 5.2 and 5.3.

## 0.8.0 (2026111800)
- Renamed to AI Virtual Classroom (mod_aivirtualclassroom). Install it as a new plugin; it does not upgrade LMS LiveLab activities.
- PowerPoint upload: teachers can upload .pptx, .ppt, .pps or .odp straight into the class. With LibreOffice on the Moodle server the slides keep their transitions and animations, and everyone sees each animation step in sync; otherwise slides are converted through LMS Labs.

## 0.7.2 (2026111700)
- Studio quality no longer freezes the page: the cut-out model now runs in a background worker, so video, buttons and audio stay responsive on any computer. Slow computers drop back to standard quality on their own.
- Lighter edge refinement (same quality, about a third of the graphics work).
- If the graphics chip resets, effects switch off with a message instead of leaving a frozen picture.

## 0.7.1 (2026111601)
- Join screen: choose Background (None, Blur, pictures, your own), Studio quality and Smooth skin before joining, with a live preview. The same choices are in More during the class.
- Studio quality: fixed a crash when switching it on while an effect was running. Effect changes now apply one at a time, the model finishes loading before the old video stops, and the model runs up to 16 times a second to keep the computer cool.

## 0.7.0 (2026111600)
- Studio quality background: a hair-level matting model (Robust Video Matting) that follows flyaway hair and edges and stays steady between frames. Switch it on in More > Background. Runs on the computer's graphics chip (WebGPU); the model ships inside the plugin and is kept by the browser after first use. Computers that cannot keep up drop back to standard quality automatically.

## 0.6.7 (2026111500)
- Background cut-out: edges now follow the real colours of the picture (guided filter), and smoothing adapts to movement: steady when still, no ghosting when you move.

## 0.6.6 (2026111401)
- Stronger background blur (about twice as strong), with no dark edges around the frame.

## 0.6.5 (2026111400)
- Much cleaner background cut-out: a better person model (separates hair, face, body and clothes), edges refined on the GPU with the full-resolution picture, smoothed between frames to stop flicker, and blended softly into the new background. Runs at full camera resolution and frame rate.

## 0.6.4 (2026111300)
- Virtual backgrounds (no green screen needed): More > Background. Choose None, Blur, six built-in backgrounds (Studio, Lavender, Ocean, Sunset, Bright office, Forest) or upload your own picture, kept on that device only.
- Change my name: More > Change my name, the pencil on the join screen, or Edit name in People. Empty resets to the Moodle name. Teachers still see the Moodle name next to a changed name; attendance and grades always use the real Moodle user.

## 0.6.3 (2026111200)
- Smooth skin: one click in More. A GPU touch-up softens skin only, keeps eyes, hair and the background sharp, and runs at full HD. Works together with background blur and is remembered for next time.
- Background blur keeps the camera's full resolution.
- Flying reactions float up more slowly (7 seconds instead of 4).

## 0.6.2 (2026111101)
- When Central Config already has the Site ID and API key, the activity page no longer asks for them; it says AI Virtual Classroom is connecting to LMS Labs.

## 0.6.1 (2026111100)
- Settings page shows the green "Central Config active" check like every LMS Labs plugin, with the AI Virtual Classroom connection status on its own line.
- No Site ID or API key fields when Central Config is installed.

## 0.6.0 (2026111001)
- Zero setup: AI Virtual Classroom uses the Site ID and API key from LMS Labs Central Config, like every LMS Labs plugin. It fetches its own security key from lms-labs.com on first use.
- Removed the Worker URL, Site ID, Shared secret, Max cameras and Simulcast settings. The live class service is built in and simulcast is always on.
- The settings page shows whether the site is connected.
- The attendance report shows learner-hours and the matching credits instead of data use.
- Copy button for the guest invite link.

## 0.5.0 (2026110900)
- Renamed to AI Virtual Classroom.
- Full HD 1080p trainer camera, HD 720p learner cameras, Full HD screen share (2 Mbps), 30 fps.
- AI class summary at the end of each class (captions, shared notes and slides), shown on the activity page.
- "AI summary" button in private notes: summarises the learner's own notes with the class context.
- Works with the AI Virtual Classroom SFU servers (self-hosted, load-balanced, cascading for big classes) as well as Cloudflare Realtime.
- Billing by learner-hours from LMS Labs credits (1 credit = 3 learner-hours); trainers are never counted.

## 0.3.0 (2026-11-07)
- Student boards: split-screen view of every student's board, mark all or one correct, pen, ticks, crosses and stamps; students can hide their name or picture.
- Captions and translation: one-question language picker, Whisper correction with key terms and slide text, sentence translation with context, "hear the class in my language".
- New design for the meeting room and join screen.
- Media reconnects by itself after a network drop instead of asking for a reload.
- Recording: profile pictures and names drawn on tiles; an empty stage records everyone instead of a blank frame; nothing-recorded case handled.
- Attendance report: download button at the top, teachers shown as "Teacher".
- New settings: Simulcast (site), Key terms for captions (activity).
- Students with no breakout room set in Moodle (and guests) now join the emptiest room instead of staying alone in the main room.
- Marketplace readiness: thirdpartylibs.xml, supported versions, notes stored as plain text, comments on the two intentionally public endpoints (signed webhook, guest link).
- "All boards" stays in the marking toolbar after changing tool.

## 0.2.0
- First complete release: breakouts per teacher, attendance and hand-raise completion, recordings emailed to students, whiteboard, slides, polls, Q&A, notes, bandwidth savers.
