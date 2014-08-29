##wilbury##
Project currently in development. Currently, the multitrack player works well.

![](/Screen%20Shot%202014-08-26%20at%208.59.58%20PM%20(2).png)
###Current features:###
- **UPDATE:** Basic recording works!! Pause where you wish the recording to start in the timeline, then hit record. When finished, hit upload to add the sound to the timeline. Playing/pausing through any of the below methods will also consider this sound. C'est tres cool. (still all local, so refresh will lose work. storing files on server is next step)
![](/bkl2a.gif)
- Clicking on a spot in any one track will play all tracks that intersect with that time.
- Spacebar plays/pauses.
- A red playhead tracks cursor movement in the appropriate track.

###Other notes:###
- This is my first project involving OOP in Javascript. After the multitrack player worked to start with, I refactored the code to reflect more modular/organized OOP.
- Web Audio API provides precise timing to play sounds. Made custom player by animating HTML elements, allowing for flexibility in positioning the sounds graphically.
- Since Web Audio API is not built for easy scheduling/cancellation of sounds, I used WAAclock as a wrapper to bypass one challenge.