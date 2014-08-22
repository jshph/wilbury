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
    this.recent_start;
    this.recent_pause;
    this.soundList = soundList;
    //this.source; //??
    this.context = context;
    this.Players;
    this.totalDuration;
    this.clock = clock;
    this.playingSounds = new Array();
    this.WAAQueue = new Array();

    this.initialize();
    // cannot have this.player.playing because one-time assignment isn't practical for a dynamic variable
}

// NOTE!!! didn't want to deal with the following:
//  - inheritance of attributes (namely, totalDuration)
//  - calling default constructors. (instead, used initialize method)
AudioHandler.prototype.initialize = function() {
    this.totalDuration = 0;
    this.Players = [];
    this.playing = false;
    // var self = this; // haven't incorporated
    this.offset_global = 0; // needed as a member for pauseManager's use.
    this.recent_start = 0, this.recent_pause = 0;

    for (var i = 0; i < this.soundList.length; i++)
        this.totalDuration += this.soundList[i].buffer.duration;

    // another loop because totalDuration will not be updated till now.
    for (var i = 0; i < this.soundList.length; i++) {
        this.Players[i] = new Player(this.soundList[i], this.totalDuration, i, this.context);

        this.soundList[i].index = i; // need to do it here and not in BufferLoader because AudioHandler receives the sorted soundList; now safe.
        // this redundancy may be useful for Player rendering specificity.
    }

    this.handleClick();
}

AudioHandler.prototype.play_onClick = function(offset_global) { // offset format, specified in handleClick, is necessary to handle clicks on elements that overlap: element clicked can have later start time than the element that it overlaps.
    this.offset_global = offset_global;

    var soundList = this.soundList;
    this.recent_start = this.context.currentTime;// + offset_global;
    var i; // first valid sound's index

    for (i = 0; i < soundList.length; i++) {
        //console.log("touched over " + i);
        this.Players[i].render("ALL", soundList[i], this);
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
    var self = this;
    var queued_event;

    function recursivePlay(index) {
        queued_event = this.clock.callbackAtTime(
            function() {
                if (self.playing && index < self.soundList.length) {
                    self.play(self.soundList[index], self);
                    recursivePlay(++index);
                    return index;
                }
                //else??
            }, Number(self.recent_start + self.soundList[index].offset - self.offset_global));
        self.WAAQueue.push(queued_event);
    }

    recursivePlay(i);
}

AudioHandler.prototype.play = function(sound, self) { // CAN I FREAKING GET RID OF THE SELF??? INHERITANCE FREAKING PROBLEMS WOW
    var playhead = self.context.currentTime - self.recent_start + self.offset_global;
    if (playhead >= sound.offset) playhead -= sound.offset; // now turns into relative offset.
    //if (self.offset_global > sound.offset) relative_offset += self.offset_global - sound.offset;
    //else /*self.offset_global < sound.offset*/ relative_offset = 
    //var relative_offset = self.offset_global + (self.context.currentTime - self.recent_start) - sound.offset;

    var player = self.Players[sound.index];

    // call to refresh correct div, id'd by index.
    var source = this.context.createBufferSource();
    source.buffer = sound.buffer;
    source.connect(this.context.destination);

    // add playing buffersource as a new property. maybe UNNECESSARY ADDITIONAL PROPERTIES.
    // NOW, PLAYINGSOunds IS EXHAUSTIVE.
    sound.source = source;
    sound.player = player;

    source.start(0, playhead);
    player.playing = true;
    // console.log("playing " + sound.index + ": " + sound.url + " from " + playhead + " / " + sound.buffer.duration);

    self.playingSounds.push(sound);

    //console.log(playhead + "/" + sound.buffer.duration);

    player.render(
        playhead, ///*(self.offset_global > sound.offset) ? playhead : playhead - (this.context.currentTime - self.recent_start)*/ 
        sound, self);

    source.onended = function() {
        //console.log('finished ' + sound.url + ": " + sound.index);
        source.stop();
        player.playing = false;
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
        sound.player.playing = false;
    });
    self.playingSounds = [];

    $(self.WAAQueue).each(function(index, WAA_event) {
        WAA_event.clear();
    });
}

AudioHandler.prototype.handleClick = function() {
    var self = this;
    // control from toggle button.
    $('#play_toggle').click(function() {
        if (self.playing) self.pauseManager();
        else self.play_onClick(self.recent_pause);
    });

    // control from middle of player.
    $(self.Players).each(function(index, player) {
        var sound = player.sound;
        $(player.player).click(function(e) {
            var newXpos = (e.clientX - $(this).offset().left);
            var new_offset_global = (newXpos / $(this).width()) * sound.buffer.duration + sound.offset;

            self.pauseManager();
            $(self.Players).each(function(index, player) {
                $(player.progress).width(0);
            });
            window.setTimeout(function(){self.play_onClick(new_offset_global);}, 50);
        });
    });
}

function Player(sound, totalDuration, index, context) {
    this.sound = sound;
    this.soundIndex = index; // used for selector
    this.totalDuration = Number(totalDuration);

    this.context = context;

    this.playing = false;

    this.player, this.progress;

    this.initialize();

    //construct div elements here.
}

var topOffset = 0;

Player.prototype.initialize = function() {
    // to incorporate Handlebars

    var sound = this.sound;
    var scale = 1000;

    var textProgress = document.createElement('div');
    $(textProgress).addClass('textProgress')
                .html("offset: " + sound.offset + " duration: " + sound.buffer.duration);

    var progress = document.createElement('div');
    $(progress).addClass('progress');

    var player = document.createElement('div');
    $(player).addClass('player')
        .width( (sound.buffer.duration / this.totalDuration) * scale)
        .css({
                'left': (sound.offset / this.totalDuration) * scale ,
                'top': topOffset
            })
        .data('id', "sound_" + this.soundIndex);
    
    $(player).append(progress);
    
    $(player).append(textProgress);

    topOffset += 65;


    $(player).appendTo($('.soundContainer'));

    // have yet to tidy up centering of all sound elements (after each add, adjust margins)

    this.player = player;
    this.progress = progress;
    this.textProgress = textProgress;
}

Player.prototype.render = function(relative_offset, sound, self) {
    var player_self = this;
    // console.log("playhead at " + relative_offset);
//console.log(offset_percentage);
    var soundProgress = relative_offset;
    var time_startRender = this.context.currentTime;
    //for animation
    function _render() {
        if (player_self.playing) {
            var soundProgress = this.context.currentTime - time_startRender + relative_offset;
            var soundPercent = (soundProgress / sound.buffer.duration) * 100;
            
            $(player_self.progress).width(soundPercent + "%");

            //and refresh number text
            //$(player_self.player).children($('.textProgress')).html(soundProgress.toFixed(2) + " / " + sound.buffer.duration.toFixed() + " secs.");

            window.requestAnimationFrame(function() {
                _render();
            });
        }
        else {
            console.log("cannot render");
            return;
        }
    }

    if (relative_offset === "ALL")
        $(player_self.progress).width("100%");
    else
        _render();
}

Player.prototype.handleClick = function() {
    // this is one area that could use "apply" to access parent's play_onClick directly.
    
} // or should it be relative to global duration? 
// offset that goes into playmanager should be: (ratio of position of buffer that's clicked) * (buffer duration) + (buffer's offset from global start)


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