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
    this.playingSongs = new Array();

    this.playing;

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

    this.pauseManager();

}

AudioHandler.prototype.play_onClick = function(offset_global) { // offset format, specified in handleClick, is necessary to handle clicks on elements that overlap: element clicked can have later start time than the element that it overlaps.
    var soundList = this.soundList;
    this.recent_start = this.context.currentTime;

    var i; // first valid sound's index

    for (i = 0; i < soundList.length; i++) {
        console.log("touched over " + i);
        if (soundList[i].offset + soundList[i].buffer.duration + this.recent_pause >= offset_global) break; // no need for -recent_start; only testing for immediate intersections
    } // aka first valid. start from here, but don't do anything yet.
    console.log("valid sound found " + soundList[i].url + " with offset " + soundList[i].offset);

    // start by playing the first valid (first conditional passes for sure)
    // again -recent_start not necessary, similarly.
    for (i; i < soundList.length; i++) {
        if (soundList[i].offset + this.recent_pause <= offset_global && soundList[i].buffer.duration + soundList[i].offset + this.recent_pause >= offset_global) {
            console.log("playing " + i + ": " + soundList[i].url + " lies between " + soundList[i].offset + " and " + Number(soundList[i].buffer.duration + soundList[i].offset));
            this.play(soundList[i], offset_global, this);
        }
        else {
            console.log(soundList[i].url + " is the first to start after the clicked position. waiting to play it.")
            this.play_Chrono(i, offset_global); //asynchronous
            break;
        }
    }
    //for (i; i < soundList.length; i++) {

   /* while (buffer_index < bufferList.length) {
        this.play(bufferList[buffer_index], buffer_index, offset_percentage);
    }*/
    
}

AudioHandler.prototype.play_Chrono = function(i, offset_global) {
    var queuedItem_temp;

    var self = this;
    // var recent_start = this.recent_start, recent_pause = this.recent_pause, play = this.play, soundList = this.soundList;

    function recursivePlay(index) {
        //console.log(index + " will start at " + Number(self.soundList[index].offset + self.recent_start - self.recent_pause - offset_global));
        queuedItem_temp = this.clock.callbackAtTime(
            function() {
                if (index < self.soundList.length) {
                    self.play(self.soundList[index], offset_global, self);
                    recursivePlay(index + 1);
                }
                else
                {
                    console.log('finished recursivePlay');
                }
            }, Number(self.soundList[index].offset + self.recent_start - self.recent_pause - offset_global));
    }

    recursivePlay(i);
}

/*function() {
            console.log('starting.');
            this.play(soundList[i], this.recent_pause + offset_global - this.recent_start offset_global, i); // later implement recent_pause
        }*/

AudioHandler.prototype.pauseManager = function() {
    // happens upon click
    $('#play_toggle').click(function() {
        var context = this.context;
        this.recent_pause = context.currentTime - this.recent_start; // snapshot
        $(this.playingSongs).each(function(index, source) {
            source.stop();
        });
    });

    /*$(this.playingSongs).each(function(index, item) {
        item.clear();
    });*/
}

AudioHandler.prototype.play = function(sound, offset_global, self) { // CAN I FREAKING GET RID OF THE SELF??? INHERITANCE FREAKING PROBLEMS WOW
    console.log(sound);


    var relative_offset = offset_global + (self.context.currentTime - self.recent_start) - sound.offset;

    var player = self.Players[sound.index];

    // call to refresh correct div, id'd by index.
    var source = this.context.createBufferSource();
    source.buffer = sound.buffer;
    source.connect(this.context.destination);

    // add playing buffersource as a new property. maybe UNNECESSARY ADDITIONAL PROPERTIES.
    // NOW, PLAYINGSONGS IS EXHAUSTIVE.
    sound.source = source;
    sound.player = player;

    source.start(0, relative_offset);
    player.playing = true;
    console.log('playing ' + sound.url);

    this.playingSongs.push(sound);

    console.log(relative_offset + "/" + sound.buffer.duration);

    player.render(
        (offset_global > sound.offset) ? relative_offset : relative_offset - (this.context.currentTime - self.recent_start),
        sound, self);

    source.onended = function() {
        console.log('finished ' + sound.url + ": " + sound.index);
        source.stop();
        player.playing = false;
    }
}

AudioHandler.prototype.handleClick = function() {
    $('#play_toggle').click(this.pauseManager);
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
}

Player.prototype.render = function(relative_offset, sound, self) {
    if (this.playing) {
    //console.log(offset_percentage);
        var soundProgress = this.context.currentTime - self.recent_start + relative_offset; // self and this for context.currentTime are colloquial???
        var soundPercent = (soundProgress / sound.buffer.duration) * 100;
        //for animation
        $(this.player).children($('.progress')).width(soundPercent + "%");
        
        var player_self = this;

        //and refresh number text
        $(this.player).children($('.textProgress')).html(soundProgress.toFixed(2) + " / " + sound.buffer.duration.toFixed() + " secs.");
        window.requestAnimationFrame(function() {
            player_self.render(relative_offset, sound, self);
        });
    }
}

Player.prototype.handleClick = function() {

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
        //audioHandler.initialize();
        audioHandler.play_onClick(1);
        // then sort the bufferList based on start offset times.
        //call AudioManager to construct
    }
}