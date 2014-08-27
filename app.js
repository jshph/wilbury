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
    
    this.totalDuration = 0;
    for (var i = 0; i < this.soundList.length; i++) {
        this.totalDuration += this.soundList[i].buffer.duration;
    }

    this.playing = false;
    this.recent_start = 0, this.recent_pause = 0;

    this.createSounds();
    // cannot have this.player.playing because one-time assignment isn't practical for a dynamic variable
}

// NOTE!!! didn't want to deal with the following:
//  - inheritance of attributes (namely, totalDuration)
//  - calling default constructors. (instead, used initialize method)
AudioHandler.prototype.createSounds = function(callback) {

    for (var i = 0; i < this.soundList.length; i++) {
        this.soundList[i] = new Sound(i, this.soundList[i], this);
        // reconstruct soundList
        // need to initialize index (i) here for sound because BufferLoader's soundlist had to be sorted in main first.
    }

    this.handleClick();
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
    // console.log("valid sound found " + soundList[i].url + " with offset " + soundList[i].offset);

    this.playing = true;
    // start by playing the first valid (first conditional passes for sure)
    // again -recent_start not necessary, similarly.
    for (i; i < soundList.length && this.playing; i++) {
        if (soundList[i].offset <= this.offset_global && soundList[i].buffer.duration + soundList[i].offset >= this.offset_global) {
            //console.log("playing " + i + ": " + soundList[i].url + " lies between " + soundList[i].offset + " and " + Number(soundList[i].buffer.duration + soundList[i].offset));
            this.play(soundList[i], this);
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

    function recursivePlay(index) {
        queued_event = this.clock.callbackAtTime(
            function() {
                if (this.playing && index < this.soundList.length) {
                    this.play(this.soundList[index], this);
                    recursivePlay(++index);
                    return index;
                }
                //else??
            }, Number(this.recent_start + this.soundList[index].offset - this.offset_global));
        this.WAAQueue.push(queued_event);
    }

    recursivePlay.call(this, i);
}

AudioHandler.prototype.play = function(sound, self) { // CAN I FREAKING GET RID OF THE SELF??? INHERITANCE FREAKING PROBLEMS WOW
    var playhead = self.context.currentTime - self.recent_start + self.offset_global;
    if (playhead >= sound.offset) playhead -= sound.offset; // now turns into relative offset.
    //if (self.offset_global > sound.offset) relative_offset += self.offset_global - sound.offset;
    //else /*self.offset_global < sound.offset*/ relative_offset = 
    //var relative_offset = self.offset_global + (self.context.currentTime - self.recent_start) - sound.offset;

    var player = sound.player;

    // call to refresh correct div, id'd by index.
    var source = this.context.createBufferSource();
    source.buffer = sound.buffer;
    source.connect(this.context.destination);

    // add playing buffersource as a new property. maybe UNNECESSARY ADDITIONAL PROPERTIES.
    // NOW, PLAYINGSOunds IS EXHAUSTIVE.
    sound.source = source;
    //sound.player = player;

    source.start(0, playhead);
    sound.playing = true;
    // console.log("playing " + sound.index + ": " + sound.url + " from " + playhead + " / " + sound.buffer.duration);

    self.playingSounds.push(sound);

    //console.log(playhead + "/" + sound.buffer.duration);

    sound.player.render(playhead);

    source.onended = function() {
        //console.log('finished ' + sound.url + ": " + sound.index);
        source.stop();
        sound.playing = false;
    }

}

AudioHandler.prototype.pauseManager = function() {
    // happens upon click
    var self = this;
    var context = this.context;

    self.recent_pause = context.currentTime - self.recent_start + self.offset_global;
    self.playing = false;
    $(self.playingSounds).each(function(index, sound) {
        sound.source.stop();
        sound.playing = false;
    });
    self.playingSounds = [];

    $(self.WAAQueue).each(function(index, WAA_event) {
        WAA_event.clear();
    });
}

AudioHandler.prototype.handleClick = function() {
    var self = this; // for convenience of anonymous functions

    $('#play_toggle').click(
        function() {
            if (self.playing) self.pauseManager();
            else self.play_onClick(self.recent_pause);
    });

    // control from middle of player.
    $(self.soundList).each(function(index, sound) {
        $(sound.player.player).click(function(e) {
            var newXpos = (e.clientX - $(this).offset().left);
            var new_offset_global = (newXpos / $(this).width()) * sound.buffer.duration + sound.offset;

            self.pauseManager();
            $(self.soundList).each(function(index, sound) {
                $(sound.player.progress).width(0);
                //$(player.textProgress).html("");
            });
            window.setTimeout(function(){self.play_onClick(new_offset_global);}, 50);
        });
    });
}

function Sound(index, sound, parent) {
    this.index = index;

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

    this.initialize();
}

Sound.prototype.initialize = function() {
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
            })
        .data('id', "sound_" + this.index);
    
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
    var time_startRender = (function() {return this.context.currentTime;}); // window object.
    var self = this;
    //for animation
    function _render() {
        if (self.sound.playing) {
            var soundProgress = this.context.currentTime - time_startRender + relative_offset;
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
        _render()
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

        soundList.sort(function(a, b) {
            return a.offset - b.offset;
        });

        audioHandler = new AudioHandler(soundList, context, clock);
    }
}