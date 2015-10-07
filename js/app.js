var map;
var config = {};
window.location.search.slice(1).split("&").forEach(function(p){
  var parts = p.split("=");
  config[parts[0]] = JSON.parse(parts[1]) || parts[1];
});
var buildings = [];
var roomIndex = {};

function dumpJSON() {
  var newObject = jQuery.extend(true, [], buildings);
  newObject.forEach(function(building) {
    building.floors.forEach(function(floor) {
      delete floor.overlay;
      (floor.rooms || []).forEach(function(room) {
        delete room.marker;
      });
    });
  });
  return JSON.stringify(newObject);
}
function focusOn(roomId) {
  console.log('focus on!', roomId);
  buildings.forEach(function(building) {
    if (!roomId.startsWith(building.sis)) {
      return;
    }
    building.floors.forEach(function(floor, floorNum) {
      (floor.rooms || []).forEach(function(room) {
        if (building.sis + " " + room.id == roomId) {
          setFloor(floorNum);
          map.setCenter(cleanPoint(room.position));
          map.setZoom(21);
        }
      });
    });
  });
};
function setFloor(floor) {
  $('#floors a.active').removeClass('active');
  $('#floors a:contains("'+floor+'")').addClass('active');

  buildings.forEach(function(building) {
    building.floors.forEach(function(f, i) {
      var m = null;
      if (i == floor) {
        m = map;
      }
      f.overlay.setMap(m);
      (f.rooms || []).forEach(function(room) {
        room.marker.setMap(m);
      });
    });
  });
}
function cleanPoint(point) {
  if (point.constructor.name === "L") {
    return point;
  }

  if (point.lat) {
    point.H = point.lat;
    delete point.lat;
  }
  if (point.lng) {
    point.L = point.lng;
    delete point.lng;
  }
  return {lng: point.L, lat: point.H};
}
function initMap() {
  if (config.edit) {
    $('#edit-mode').css('display', 'block');
  }
  function updateSearch() {
    var room = window.location.hash.slice(1);
    $('#search').val(room);
    if (roomIndex[room]) {
      focusOn(room);
    }
    search();
  }
  $(window).on('hashchange', function() {
    setTimeout(updateSearch,0);
  });
  map = new google.maps.Map(document.getElementById('map'), {
    center: {
      lat: 49.26119707839249,
      lng: -123.24878096580505
    },
    mapTypeControl: false,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    zoom: 20
  });
  google.maps.event.addListener(map, 'click', function(event) {
    console.log("click", event.latLng);
  });
  var index = lunr(function () {
    this.ref('id');
    this.field('room', 10);
    this.field('name');
    this.field('buildingName')
  });
  function search() {
    var search = $('#search').val();
    var html = '';
    var results = index.search(search);
    console.log('search results', results);
    results.forEach(function(result) {
      var room = roomIndex[result.ref]
      html += '<a href="#'+result.ref+'" class="collection-item">'+(room.name || '')+' <span class="room">'+result.ref+'</span></a>';
    });
    $('#search-results').html(html);
  }
  $('form').on('keyup submit', function(e) {
    setTimeout(search, 0);
  }).on('submit', function(e) { e.preventDefault(); });

  function setupRoom(building, floor, room, show) {
    var img = 'img/dot-red.png';
    if (room.type == 'food') {
      img = 'img/icons/restaurant.png';
    } else if (room.type == 'restroom') {
      img = 'img/icons/toilets.png';
    }
    var marker = new google.maps.Marker({
      position: cleanPoint(room.position),
      title: room.id,
      icon: img,
    });
    if (show) {
      marker.setMap(map);
    }
    room.marker = marker;
    var roomId = building.sis + " " + room.id;
    roomIndex[roomId] = room;
    index.add({
      room: roomId,
      buildingName: building.name,
      name: room.name,
      id: roomId,
    });
    google.maps.event.addListener(marker, 'click', function(e) {
      var html = '<div>'+roomId;
      if (config.edit) {
        html += '<input class="name" type="text"/>' +
          '<select class="type browser-default">' +
          '<option value="">room</option>' +
          '<option>food</option>' +
          '<option>restroom</option>' +
          '</select>' +
          '<a class="waves-effect btn-flat delete">Delete</a>';
      }
      html += '</div>';
      var $content = $(html);

      $content.find('.name').val(room.name || '').on('keyup', function(e) {
        setTimeout(function() {
          room.name = $content.find('.name').val();
        }, 0);
      });

      $content.find('.type').val(room.type || '').on('change', function(e) {
        room.type = $(this).val();
      });

      $content.find('.delete').click(function(e) {
        room.marker.setMap(null);
        floor.rooms = floor.rooms.filter(function(r) { return r!=room; });
      });

      var infowindow = new google.maps.InfoWindow({
        content: $content.get(0),
        maxWidth: 200
      });
      infowindow.open(map, marker);
    });
  }

  $.getJSON('maps/map.json', function(data) {
    buildings = data;
    var maxFloors = 0;

    buildings.forEach(function(building) {
      if (building.floors.length > maxFloors) {
        maxFloors = building.floors.length;
      }
      building.floors.forEach(function(floor) {
        floor.overlay = new google.maps.GroundOverlay(floor.image, floor.coords);
        google.maps.event.addListener(floor.overlay, 'click', function(event) {
          console.log("click", event.latLng);
          if (!config.edit) return;
          var id = prompt('Enter room number:');
          if (!id) return;
          if (!floor.rooms) {
            floor.rooms = [];
          }
          var room = {
            id: id,
            position: event.latLng,
          };
          floor.rooms.push(room);
          setupRoom(building, floor, room, true);
        });

        (floor.rooms || []).forEach(function(room) {
          setupRoom(building, floor, room);
        });
      });
    });
    for (var i=0;i<maxFloors;i++) {
      document.querySelector("#floors").innerHTML+='<a class="waves-effect btn-flat">'+(maxFloors-i-1)+'</a>';
    }
    $('#floors a').click(function() {
      setFloor(parseInt($(this).text(), 10));
    });
    setFloor(1);
    updateSearch();
  });
}
