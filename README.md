##wilbury##
=======
Project currently in development. Currently, the player, which manages playback of multiple audio files scattered throughout the timeline, works without a hitch.

![](/https://www.dropbox.com/s/cyhcy7lc8651o7o/Screen%20Shot%202014-08-26%20at%208.59.58%20PM%20%282%29.png?dl=0)
###Current features:###
- Clicking on a spot in any one track will play all tracks that intersect with that time.
- Play/pause button is also functional.
- A red playhead tracks cursor movement in the appropriate track.

###Other notes:###
- This is my first project involving OOP in Javascript. After the multitrack player worked to start with, I refactored the code to reflect more modular/organized OOP.
- Web Audio API provides precise timing to play sounds. Made custom player by animating HTML elements, allowing for flexibility in positioning the sounds graphically.
- Since Web Audio API is not built for easy scheduling/cancellation of sounds, I used WAAclock as a wrapper to bypass one challenge.