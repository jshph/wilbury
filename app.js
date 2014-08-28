function BufferLoader(context, soundList, callback) {
    this.context = context;
    this.soundList = soundList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
}

// loadBuffer also loads sound metadata into the bufferList array.
BufferLoader.prototype.loadBuffer = function(sound, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", sound.url, true);
    request.responseType = "arraybuffer";

    var loader = this;

    request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
        request.response,
        function(buffer) {
        if (!buffer) {
            alert('error decoding file data: ' + url);
            return;
        }
        // buffer is the main purpose, but metadata offset and url are also part of the object.
        // thus bufferList is more the update of soundList.
        loader.bufferList.push({"buffer": buffer, "offset": Number(sound.offset), "url": sound.url});
        console.log('loaded buffer ' + index + ": " + sound.url);
        if (++loader.loadCount == loader.soundList.length)
            loader.onload(loader.bufferList);
        },
        function(error) {
            console.error('decodeAudioData error', error);
        }
    );
    }

    request.onerror = function() {
        alert('BufferLoader: XHR error');
    }

    request.send();
}

BufferLoader.prototype.load = function() {
    for (var i = 0; i < this.soundList.length; ++i) {
        this.loadBuffer(this.soundList[i], i);
    }
}



function AudioHandler(soundList, context, clock) {
    this.soundList = soundList;
    //this.source; //??
    this.context = context;
    this.totalDuration;
    this.clock = clock;
    this.playingSounds = new Array();
    this.WAAQueue = new Array();

    this.offset_global = 0; // needed as a member for pauseManager's use.
    
    // intialize totalDuration
    this.totalDuration = 0;
    for (var i = 0; i < this.soundList.length; i++) {
        this.totalDuration += this.soundList[i].buffer.duration;
    }

    this.playing = false;
    this.recent_start = 0, this.recent_pause = 0;


    // initialize soundList (including initial sort by offset)
    // by converting the format of soundList (swap).
    // TO IMPROVE: partition-based conversion.
    this.temp = new Array();
    for (var i = 0; i < this.soundList.length; i++) {
        //this.soundList[i] = new Sound(i, this.soundList[i], this);
        this.temp.push(new Sound(this.soundList[i], this));
        // reconstruct soundList
        // need to initialize index (i) here for sound because BufferLoader's soundlist had to be sorted in main first.
    }
    this.soundList = this.temp;
    this.soundList.sort(function(a, b) {
            return a.offset - b.offset;
    });

    this.handleClick();
}

AudioHandler.prototype.createSound = function(sound) {
    this.soundList.push(new Sound(this.soundList[i], this));
    this.soundList.sort(function(a, b) {
            return a.offset - b.offset;
    });
}



AudioHandler.prototype.play_onClick = function(offset_global) { // offset format, specified in handleClick, is necessary to handle clicks on elements that overlap: element clicked can have later start time than the element that it overlaps.
    this.offset_global = offset_global;

    var soundList = this.soundList; // for convenience
    this.recent_start = this.context.currentTime;// + offset_global;
    var i; // first valid sound's index

    for (i = 0; i < soundList.length; i++) {
        soundList[i].player.render("ALL");
        if (soundList[i].offset + soundList[i].buffer.duration >= this.offset_global) break;
    } // aka first valid. start from here, but don't do anything yet.

    this.playing = true;
    // start by playing the first valid (first conditional passes for sure)
    for (i; i < soundList.length && this.playing; i++) {
        if (soundList[i].offset <= this.offset_global && soundList[i].buffer.duration + soundList[i].offset >= this.offset_global) {
            //console.log("playing " + i + ": " + soundList[i].url + " lies between " + soundList[i].offset + " and " + Number(soundList[i].buffer.duration + soundList[i].offset));
            soundList[i].play();
        }
        else {
            //console.log(soundList[i].url + " is the first to start after the clicked position. waiting to play it.")
            this.play_Chrono(i); //asynchronous
            break;
        }
    }
}

AudioHandler.prototype.play_Chrono = function(i) {
    var queued_event;
    var self = this; // again, not proper. unless i discover proper way to deal with anonymous func and context
    function recursivePlay(index) {
        queued_event = this.clock.callbackAtTime(function() {
                if (self.playing && index < self.soundList.length) {
                    self.soundList[index].play();
                    recursivePlay(++index);
                    return index;
                }
            }, Number(self.recent_start + self.soundList[index].offset - self.offset_global));
        self.WAAQueue.push(queued_event);
    }

    recursivePlay(i);
}

AudioHandler.prototype.pauseManager = function() {
    // happens upon click
    var self = this;
    var context = this.context;

    self.recent_pause = context.currentTime - self.recent_start + self.offset_global;
    self.playing = false;
    $(self.playingSounds).each(function(index, sound) {
        sound.pause();
    });
    self.playingSounds = [];

    $(self.WAAQueue).each(function(index, WAA_event) {
        WAA_event.clear();
    });
}

AudioHandler.prototype.handleClick = function() {
    var self = this; // for convenience of anonymous functions

    $(document).keyup(function(e) {
        if (e.keyCode === 32) {
            if (self.playing) self.pauseManager();
            else self.play_onClick(self.recent_pause);
        }
    });

    // control from middle of player.
    $(self.soundList).each(function(index, sound) {
        // the player clicked will callback the parameter.
        sound.player.handleClick(function(new_offset_global) {
            self.pauseManager();
            $(self.soundList).each(function(index, sound) {
                sound.player.resetWidth();
                //$(player.textProgress).html("");
            });
            window.setTimeout(function(){self.play_onClick(new_offset_global);}, 50);
        });
    });
}

function Sound(sound, parent) {

    this.buffer = sound.buffer;
    this.url = sound.url;
    this.offset = sound.offset;
    this.playing = false; // * USE!!!!
    this.parent = parent; // AudioHandler
    /*
        of importance:
        - totalDuration
        - recent_start
        - recent_pause
        - offset_global
     */
    this.player = new Player(this);
}

Sound.prototype.play = function() { // CAN I FREAKING GET RID OF THE SELF??? INHERITANCE FREAKING PROBLEMS WOW
    var playheadTime = this.parent.context.currentTime - this.parent.recent_start + this.parent.offset_global;
    if (playheadTime >= this.offset) playheadTime -= this.offset; // now turns into relative offset.
    //if (self.offset_global > sound.offset) relative_offset += self.offset_global - sound.offset;
    //else /*self.offset_global < sound.offset*/ relative_offset = 
    //var relative_offset = self.offset_global + (self.context.currentTime - self.recent_start) - sound.offset;

    // call to refresh correct div, id'd by index.
    this.source = this.parent.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.parent.context.destination);

    this.source.start(0, playheadTime);
    this.playing = true;
    // console.log("playing " + sound.index + ": " + sound.url + " from " + playheadTime + " / " + sound.buffer.duration);

    this.parent.playingSounds.push(this);

    //console.log(playheadTime + "/" + sound.buffer.duration);

    this.player.render(playheadTime);

    // BAADDD
    var source = this.source;
    var sound = this;
    source.onended = (function() {
        //console.log('finished ' + sound.url + ": " + sound.index);
        source.stop();
        sound.playing = false;
    })

}

Sound.prototype.pause = function() {
    this.source.stop();
    this.playing = false;
}

function Player(parentSound) {
    //this.player.player, this.player.progress, this.player.textProgress;
    this.sound = parentSound; // of course, this.player.sound.buffer, etc, is available in Sound class but never used.

    this.initialize();
    this.movePlayhead();
}

var topOffset = 0;

Player.prototype.initialize = function() {
    // to incorporate Handlebars
    var scale = 1000;

    this.textProgress = document.createElement('div');
    $(this.textProgress).addClass('textProgress')
                .html("");

    this.progress = document.createElement('div');
    $(this.progress).addClass('progress');

    this.player = document.createElement('div');
    $(this.player).addClass('player')
        .width( (this.sound.buffer.duration / this.sound.parent.totalDuration) * scale)
        .css({
                'left': (this.sound.offset / this.sound.parent.totalDuration) * scale ,
                'top': topOffset
            });
    
    $(this.player).append(this.progress);
    
    $(this.player).append(this.textProgress);

    topOffset += 65;

    $(this.player).appendTo($('.soundContainer'));

    // have yet to tidy up centering of all sound elements (after each add, adjust margins)

    this.overPlayer = document.createElement('div');
    $(this.overPlayer).addClass('overPlayer');
    $(this.player).append(this.overPlayer);

    // initialize playhead
    this.playhead = document.createElement('div');
    $(this.playhead).addClass('playhead');
    $(this.player).append(this.playhead);
}

Player.prototype.render = function(relative_offset) {
    // console.log("playhead at " + relative_offset);
    var time_startRender = this.sound.parent.context.currentTime; // window object.
    var self = this;
    //for animation
    function _render() {
        if (self.sound.playing) {
            var soundProgress = self.sound.parent.context.currentTime - time_startRender + relative_offset;
            var soundPercent = (soundProgress / self.sound.buffer.duration) * 100;
            
            $(self.progress).width(soundPercent + "%");

            //and refresh number text
            //$(player_self.player).children($('.textProgress')).html(soundProgress.toFixed(2) + " / " + sound.buffer.duration.toFixed() + " secs.");

            window.requestAnimationFrame(function() {
                _render();
            });
        }
        else {
            return;
        }
    }

    if (relative_offset === "ALL")
        $(this.progress).width("100%");
    else
        _render();
}

Player.prototype.resetWidth = function() {$(this.progress).width(0);}

Player.prototype.handleClick = function(callback) {
    var self = this;
    $(this.player).click(function(e) {
        var newXpos = (e.clientX - $(this).offset().left);
        var new_offset_global = (newXpos / $(this).width()) * self.sound.buffer.duration + self.sound.offset;
        
        callback(new_offset_global);
    });
}

Player.prototype.movePlayhead = function() {
    var playhead = this.playhead;
    
    $(this.overPlayer).mousemove(function(event) {
        $(playhead).css({'left':event.offsetX});
    });
}

window.onload = init;

var context, bufferloader, audioHandler, clock;

function init() {
  // Fix up prefixing
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    context = new AudioContext();
    clock = new WAAClock(context);
    bufferloader = new BufferLoader(
        context,
        [
            {"url": "/../sample_songs/tsi.mp3", "offset": 0},
            {"url": "/../sample_songs/pakabaka.mp3", "offset": 4},
            {"url": "/../sample_songs/mmmmm.mp3", "offset": 9}
        ],
        finishedLoading
        );

    bufferloader.load();

    function finishedLoading(retrieved_soundList) {
        clock.start();
        var soundList = retrieved_soundList;

        audioHandler = new AudioHandler(soundList, context, clock);
    }
}