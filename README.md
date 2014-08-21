wilbury
=======
Project currently in development. So, what works?
- The page loads. The audio loads, then autoplays from a hardcoded starting point. All audio files are laid out as they are to be played relative to each other. Audio starts/overlays/ends accurately.

Current features:
- Web Audio API provides precise timing to play sounds. Made custom player by animating HTML elements, allowing for flexibility in positioning the sounds graphically.
- Since Web Audio API is not built for easy scheduling/cancellation of sounds, I used WAAclock as a wrapper to bypass one challenge.