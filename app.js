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
    this.orig_totalDuration = this.totalDuration; // preserve for new sound initialize.

    this.playing = false;
    this.recent_start = 0, this.recent_pause = 0;
    this.numSounds = 0;


    // initialize soundList (including initial sort by offset)
    // by converting the format of soundList (swap).
    // TO IMPROVE: partition-based conversion. cannot use createSound right now because of swap necessity.
    this.temp = new Array();
    for (var i = 0; i < this.soundList.length; i++) {
        //this.soundList[i] = new Sound(i, this.soundList[i], this);
        this.temp.push(new Sound(this.soundList[i], ++this.numSounds, this));
        // reconstruct soundList
        // need to initialize index (i) here for sound because BufferLoader's soundlist had to be sorted in main first.
    }
    this.soundList = this.temp;
    this.soundList.sort(function(a, b) {
            return a.offset - b.offset;
    });

    this.rec_status;
    this.recent_recPos;

    this.handleClick();
}

AudioHandler.prototype.createSound = function(buffer) {
    this.totalDuration += Number(buffer.duration);
        
    var sound = {
        'url': 'asdfsafdsadf',
        'buffer': buffer,
        'offset': this.recent_recPos
    }
    this.soundList.push(new Sound(sound, ++this.numSounds, this));
    // TO IMPROVE: insertion sort by sound offset.
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
        soundList[i].player.render("ALL"); // bogus argument.
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

    // manage global keypress
    $(document).keyup(function(e) {
        if (e.keyCode === 32) {
            if (self.playing) self.pauseManager();
            else self.play_onClick(self.recent_pause);
        }
    });

    // that of clicking on individual players has been moved to Player object initialization.
}

function Sound(sound, addedOrder, parent) {
    this.addedOrder = addedOrder;
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

Sound.prototype.play = function() {
    var playheadTime = this.parent.context.currentTime - this.parent.recent_start + this.parent.offset_global;
    if (playheadTime >= this.offset) playheadTime -= this.offset; // now turns into relative offset.

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
    this.sound = parentSound; // of course, this.player.sound.buffer, etc, is available in Sound class but never used.

    this.initialize();
    this.movePlayhead();

    var self = this;
    this.handleClick(function(new_offset_global) {
        self.sound.parent.pauseManager();
        $(self.sound.parent.soundList).each(function(index, sound) {
            sound.player.resetWidth();
            //$(player.textProgress).html("");
        });
        window.setTimeout(function(){
            self.sound.parent.play_onClick(new_offset_global);
        }, 50);
    });
}

Player.prototype.initialize = function() {
    // to incorporate Handlebars
    var scale = 1000;

    // IMPORTANT: This function is arranged to render from inside out.


    // create element that contains the sound progress (more of a background)
    this.player = document.createElement('div');
    $(this.player).addClass('player_sound');

    // create element that displays progress of sound.
    this.progress = document.createElement('div');
    $(this.progress).addClass('progress_sound');
    $(this.player).append(this.progress);
    
    /*this.textProgress = document.createElement('div');
    $(this.textProgress).addClass('textProgress')
                .html("");*/
    // $(this.player).append(this.textProgress);

    // create overPlayer to track mouse movement for playhead.
    this.overPlayer = document.createElement('div');
    $(this.overPlayer).addClass('overPlayer_sound');
    $(this.player).append(this.overPlayer);

    // initialize playhead
    this.playhead = document.createElement('div');
    $(this.playhead).addClass('playhead');
    $(this.player).append(this.playhead);

    // kinda not inside->out here on...

    // Create player wrapper (including controls for play, pause, record, sound, etc)
    this.playerCont = document.createElement('div');
    $(this.playerCont).addClass('playerCont')
        .width( (this.sound.buffer.duration / this.sound.parent.orig_totalDuration) * scale)
        .css({
                'left': (this.sound.offset / this.sound.parent.orig_totalDuration) * scale
                //'top': playerCont_topoffset
            })
        .data('id', 'added_' + this.sound.addedOrder);

    // play / pause and mute buttons.
    this.playToggle = document.createElement('div');
    $(this.playToggle).addClass('player_control control-play');
    this.mute = document.createElement('div');
    $(this.mute).addClass('player_control control-mute');
    $(document.createElement('div')).addClass('controlCont_side')
            .append($(this.playToggle), $(this.mute))
            .appendTo($(this.playerCont));

    this.recordBar = document.createElement('div');
    $(this.recordBar).addClass('recordBar')
            .appendTo($(this.playerCont));

    this.overRecordbar = document.createElement('div');
    $(this.overRecordbar).addClass('overPlayer_sound') // aka overRecord
            .appendTo($(this.recordBar));

    this.recordButton = document.createElement('div');
    $(this.recordButton).addClass('recordButton')
            .appendTo($(this.recordBar));

    $(this.player).appendTo($(this.playerCont));

    // create horizontal row for player to be arranged in.
    this.soundRow = document.createElement('div');
    $(this.soundRow).addClass('soundRow');
    $(this.playerCont).appendTo($(this.soundRow));

    $(this.soundRow).appendTo($('.daw'));
    // playerCont_topoffset += playerCont_height + 15;

    // have yet to tidy up centering of all sound elements (after each add, adjust margins)
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

Player.prototype.movePlayhead = function() { // and move Record Button
    var self = this;
    var playhead = this.playhead;
    var recordButton = this.recordButton;

    $(this.overPlayer).mousemove(function(event) {
        $(playhead).css({'left':event.offsetX});
    });

    $(this.overRecordbar).mousemove(function(event) {
        $(recordButton).css({'left':event.offsetX - 9});
        if (self.sound.parent.rec_status) {// handle recording start position
            self.sound.parent.recent_recPos = (event.clientX - 9 - $(this).offset().left) / $(this).width() * self.sound.buffer.duration + self.sound.offset;
            console.log(self.sound.parent.recent_recPos);
        }
    });
}

window.onload = init;

var context, bufferloader, audioHandler, clock, recorder;

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
        audioHandler = new AudioHandler(retrieved_soundList, context, clock);
        initRecord();
    }

    function initRecord() {
        // should unhide the record/submit controls here (or reveal)

        navigator.getUserMedia = ( navigator.getUserMedia ||
                   navigator.webkitGetUserMedia ||
                   navigator.mozGetUserMedia ||
                   navigator.msGetUserMedia);
        navigator.getUserMedia({audio:true}, startUserMedia, function(e) {
            console.log("No live audio input: " + e);
        });
    }

    function startUserMedia(stream) {
        var input = context.createMediaStreamSource(stream);

        var zeroGain = context.createGain();
        zeroGain.gain.value = 0;
        input.connect(zeroGain);
        zeroGain.connect(context.destination);

        recorder = new Recorder(input);

        // Recorder object created, now safe to record.
        listenRecord_start();
        listenRecord_stop();
    }

    function listenRecord_start() {
        $('.overPlayer_sound').click(function() {
            console.log('Recording...');
            recorder && recorder.record();
            audioHandler.pauseManager();
            audioHandler.rec_status = true; // now tells player to register xPos
        });
    }

    function listenRecord_stop() {
        $('#submitSound').click(function() {
            recorder && recorder.stop();
            console.log('Stopped recording.');
            audioHandler.rec_status = false;
            // create WAV download link using audio data blob
            // createDownloadLink();
            recorder.getBuffer(function(buffers) {
                var newBuffer = context.createBuffer( 2, buffers[0].length, context.sampleRate );
                newBuffer.getChannelData(0).set(buffers[0]);
                newBuffer.getChannelData(1).set(buffers[1]);
                audioHandler.createSound.call(audioHandler, newBuffer);
            });
            
            recorder.clear();
        });
    }

    /*function createDownloadLink() {
        recorder && recorder.exportWAV(function(blob) {
          // var url = URL.createObjectURL(blob);
          // listenSubmit(url);
          var li = document.createElement('li');
          var au = document.createElement('audio');
          var hf = document.createElement('a');
          
          au.controls = true;
          au.src = url;
          hf.href = url;
          hf.download = new Date().toISOString() + '.wav';
          hf.innerHTML = hf.download;
          li.appendChild(au);
          li.appendChild(hf);
          recordingslist.appendChild(li);
          console.log(blob);
        });
    }*/

/////////
    function listenSubmit(url) {
        $('#submitSound').css({'display': 'inline-block'});
        $('#submitSound').click(function() {
            var newSound_bufferloader = new BufferLoader(
                    context,
                    [{"url": url, "offset": 1}], 
                    function(soundList) {
                        audioHandler.createSound.call(audioHandler, soundList[0]);
                    }
                );
            newSound_bufferloader.load();
        });
    }
}