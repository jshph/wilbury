wilbury
=======
Project currently in development. Currently, the player, which manages playback of multiple audio files scattered throughout the timeline, works without a hitch. There is still some polishing that has to be done on the front-end and feedback side.

Current features:
- Web Audio API provides precise timing to play sounds. Made custom player by animating HTML elements, allowing for flexibility in positioning the sounds graphically.
- Since Web Audio API is not built for easy scheduling/cancellation of sounds, I used WAAclock as a wrapper to bypass one challenge.