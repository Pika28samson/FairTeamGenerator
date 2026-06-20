let players = [];

let nextPlayerId = 1;

let pairs = [];

let unpaired = [];

const playerList =
    document.getElementById("playerList");



function showStage(n){

    document
        .querySelectorAll(".stage")
        .forEach(
            s=>s.classList.add("hidden")
        );

    document
        .getElementById(
            "stage"+n
        )
        .classList.remove(
            "hidden"
        );


    document
        .querySelectorAll(".tab")
        .forEach(
            t=>t.classList.remove(
                "active"
            )
        );


    document
        .querySelectorAll(".tab")
        [n-1]
        .classList.add(
            "active"
        );

}



function addPlayer(){

    const input =

    document.getElementById(
        "playerInput"
    );



    const name =

    input.value.trim();



    if(name==="")
        return;



    players.push({

        id:nextPlayerId++,

        name:name,

        active:true

    });



    input.value="";



    renderPlayers();

}



function removePlayer(index){

    players.splice(
        index,
        1
    );

    renderPlayers();

}



function selectAll(v){

    players.forEach(p=>{

        p.active=v;

    });

    renderPlayers();

}



function renderPlayers(){

    playerList.innerHTML="";


    players.forEach((p,i)=>{


        const row=

        document.createElement(
            "div"
        );


        row.className=
        "player";


        row.dataset.index=i;


        row.innerHTML=`

        <div class="player-rank">

            #${i+1}

        </div>


        <input

        type="checkbox"

        ${p.active?"checked":""}

        >

        <div class="player-name">

            ${p.name}

        </div>


        <button

        class="player-remove"

        >

            X

        </button>

        `;



        const checkbox=

        row.querySelector(
            "input"
        );


        checkbox.onchange=()=>{

            p.active=
            checkbox.checked;

        };



        row.querySelector(
            "button"
        )

        .onclick=()=>{

            removePlayer(i);

        };



        playerList.appendChild(
            row
        );

    });

    players.forEach((p, i) => {
        p.rank = i + 1;
    });

}



new Sortable(

    playerList,

    {

        animation:150,

        onEnd:function(evt){


            const moved=

            players.splice(

                evt.oldIndex,

                1

            )[0];



            players.splice(

                evt.newIndex,

                0,

                moved

            );


            renderPlayers();

        }

    }

);



showStage(1);

renderPlayers();

let usePairs = true;


function goStage2() {
    autoGeneratePairs();
    showStage(2);
}


function togglePairs(){

    usePairs=

    document

    .getElementById(

        "usePairs"

    )

    .checked;

}



function autoGeneratePairs() {
    pairs = [];
    unpaired = [];

    const active = getActivePlayers();

    let i = 0;

    while (i < active.length) {

        const p1 = active[i];

        const p2 = active[i + 1];

        if (p2) {
            pairs.push([p1.id, p2.id]);
        } else {
            unpaired.push(p1.id);
        }

        i += 2;
    }

    renderPairs();
}



function addEmptyPair() {
    pairs.push([]);
    renderPairs();
}



function deletePair(index) {

    const removed = pairs.splice(index, 1)[0];

    // move removed players to unpaired
    removed.forEach(id => {
        if (!unpaired.includes(id)) {
            unpaired.push(id);
        }
    });

    renderPairs();
}



function renderPairs() {

    const container =
        document.getElementById("pairContainer");

    container.innerHTML = "";

    // render pairs
    pairs.forEach((pair, index) => {

        const box = document.createElement("div");
        box.className = "pair";

        box.innerHTML = `
            <div class="pair-header">
                <h3>Pair ${index + 1}</h3>
                <button onclick="deletePair(${index})">X</button>
            </div>
            <div class="pair-list" id="pair-${index}"></div>
        `;

        container.appendChild(box);

        const list = box.querySelector(".pair-list");

        pair.forEach(id => {
            const p = getPlayer(id);
            if (!p) return;

            const el = document.createElement("div");
            el.className = "pair-player";
            el.dataset.id = id;
            el.innerText = p.name;

            list.appendChild(el);
        });

        new Sortable(list, {
            group: "shared",
            animation: 150,
            onEnd: syncFromDOM
        });
    });

    // render unpaired box
    const unpairedBox = document.getElementById("unpaired");
    unpairedBox.innerHTML = "";

    unpaired.forEach(id => {

        const p = getPlayer(id);
        if (!p) return;

        const el = document.createElement("div");
        el.className = "pair-player";
        el.dataset.id = id;
        el.innerText = p.name;

        unpairedBox.appendChild(el);
    });

    new Sortable(unpairedBox, {
        group: "shared",
        animation: 150,
        onEnd: syncFromDOM
    });
}



function createPairPlayer(player){


    const div=

    document

    .createElement(

        "div"

    );


    div.className=

    "pair-player";


    div.dataset.id=
    player.id;


    div.innerText=

    player.name;


    return div;

}



function addToUnpaired(player){

    const unpaired=

    document

    .getElementById(

        "unpaired"

    );


    unpaired.appendChild(

        createPairPlayer(

            player

        )

    );

}



function initUnpairedSortable(){

    const box=

    document

    .getElementById(

        "unpaired"

    );


    new Sortable(

        box,

        {

            group:"pairs",

            animation:150

        }

    );

}

function getPlayerById(id){

    return players.find(

        p=>p.id===id

    );

}

function getActivePlayers() {
    return players.filter(p => p.active);
}

function getPlayer(id) {
    return players.find(p => p.id === id);
}

function syncFromDOM() {

    const newPairs = [];
    const newUnpaired = [];

    // read all pairs
    document.querySelectorAll(".pair-list").forEach(list => {

        const ids = [];

        list.querySelectorAll(".pair-player").forEach(el => {
            ids.push(parseInt(el.dataset.id));
        });

        // enforce max 2 per pair
        if (ids.length > 2) {
            newUnpaired.push(...ids.slice(2));
            ids.length = 2;
        }

        if (ids.length > 0) {
            newPairs.push(ids);
        }
    });

    // read unpaired
    document.querySelectorAll("#unpaired .pair-player").forEach(el => {
        newUnpaired.push(parseInt(el.dataset.id));
    });

    pairs = newPairs;
    unpaired = newUnpaired;

    renderPairs(); // re-render to enforce rules visually
}

function generateTeams() {
    let teamA = [];
    let teamB = [];

    // Check if the user turned off matching pairs
    if (!usePairs) {
        
        // 1. Get all active players
        let allActive = getActivePlayers();
        
        // 2. Shuffle them truly randomly (Fisher-Yates shuffle algorithm)
        for (let i = allActive.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allActive[i], allActive[j]] = [allActive[j], allActive[i]];
        }

        // 3. Deal them evenly between Team A and Team B like a deck of cards
        allActive.forEach((p, index) => {
            if (index % 2 === 0) {
                teamA.push(p);
            } else {
                teamB.push(p);
            }
        });

    } else {
        
        // --- WHEN MATCHING PAIRS IS ON ---
        
        // 1. PAIRED PLAYERS (forced split, truly random)
        pairs.forEach(pair => {
            if (pair.length === 2) {
                const p1 = getPlayer(pair[0]);
                const p2 = getPlayer(pair[1]);
                if (!p1 || !p2) return;

                // 50/50 coin flip to decide who goes to which team
                if (Math.random() < 0.5) {
                    teamA.push(p1);
                    teamB.push(p2);
                } else {
                    teamA.push(p2);
                    teamB.push(p1);
                }
            }
        });

        // 2. UNPAIRED PLAYERS
        unpaired.forEach(id => {
            const p = getPlayer(id);
            if (!p) return;

            // If teams are uneven, put the unpaired player on the smaller team. 
            // If teams are currently tied, flip a coin.
            if (teamA.length < teamB.length) {
                teamA.push(p);
            } else if (teamB.length < teamA.length) {
                teamB.push(p);
            } else {
                if (Math.random() < 0.5) {
                    teamA.push(p);
                } else {
                    teamB.push(p);
                }
            }
        });
    }

    renderTeams(teamA, teamB);
}

function renderTeams(teamA, teamB) {

    const listA = document.getElementById("teamA");
    const listB = document.getElementById("teamB");

    listA.innerHTML = "";
    listB.innerHTML = "";

    teamA.forEach(p => {
        const li = document.createElement("li");
        li.innerText = p.name;
        listA.appendChild(li);
    });

    teamB.forEach(p => {
        const li = document.createElement("li");
        li.innerText = p.name;
        listB.appendChild(li);
    });

    // optional simple balance score (based on rank position)
    document.getElementById("scoreA").innerText = teamA.length;
    document.getElementById("scoreB").innerText = teamB.length;

    showStage(3);
}

function savePreset() {

    const name = document.getElementById("presetName").value.trim();

    if (!name) return alert("Enter preset name");

    const data = {
        players,
        pairs,
        unpaired
    };

    localStorage.setItem(
        "bb_preset_" + name,
        JSON.stringify(data)
    );

    refreshPresets();
}

function loadPreset() {

    const key = document.getElementById("presetSelect").value;

    if (!key) return;

    const data = JSON.parse(localStorage.getItem(key));

    players = data.players || [];
    pairs = data.pairs || [];
    unpaired = data.unpaired || [];

    renderPlayers();
    renderPairs();
}

function deletePreset() {

    const key = document.getElementById("presetSelect").value;

    if (!key) return;

    localStorage.removeItem(key);

    refreshPresets();
}

function refreshPresets() {

    const select = document.getElementById("presetSelect");

    select.innerHTML = "";

    Object.keys(localStorage)
        .filter(k => k.startsWith("bb_preset_"))
        .forEach(k => {

            const opt = document.createElement("option");

            opt.value = k;
            opt.textContent = k.replace("bb_preset_", "");

            select.appendChild(opt);
        });
}

refreshPresets();
