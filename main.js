const ENTER_KEY_CODE = 13;
$(() => {
    'use strict';
    chrome.identity.getAuthToken({'interactive': true}, (token) => {
        gapi.load('client', {
            callback: () => {
                gapi.client.setToken({access_token: token});
            },
            onerror: () => {
                // @TODO handle error here properly
                alert('gapi.client failed to load!');
            },
            timeout: 5000, // 5 seconds.
            ontimeout: () => {
                // @TODO handle error here properly
                alert('gapi.client could not load in a timely manner!');
            }
        });

        function gapiClientLoadCb() {
            // Handle gapi.client initialization.

            var request = gapi.client.request({
                'method': 'GET',
                'path': "/drive/v3/files?",
                'params': {
                    'fields': 'nextPageToken, files(id, name, parents, iconLink, owners)',
                    'q': '"ivan@zgtec.com" in owners'
                }
            });
            request.execute(function (response) {
                console.log(response);
            });
        }

        const filesContainer = $('.files-container');

        function searchHandler(searchStr) {
            var request = gapi.client.request({
                'method': 'GET',
                'path': "/drive/v3/files?",
                'params': {
                    'fields': 'nextPageToken, files(id, name, parents, iconLink, owners, modifiedTime, size)',
                    'q': `"${searchStr}" in owners and mimeType != "application/vnd.google-apps.folder"`
                }
            });
            request.execute(function (response) {
                console.log(response);
                if (response.files !== undefined) {
                    if (response.files.length > 0) {
                        buildFilesGrid(response.files);
                        $('#select-all').prop("disabled", false);
                    } else {
                        $('#select-all').prop("disabled", true);
                        filesContainer.html('No files available');
                    }
                } else {
                    // @TODO handle error here
                }
            });
        }

        $('#search-box input').keypress(function (event) {
            if (event.which === ENTER_KEY_CODE) {
                searchHandler($(this).val())
            }
        });

        $('#search-box .btn').click(() => {
            searchHandler($('#search-box input').val())
        });

        function buildFilesGrid(files) {
            filesContainer.empty();
            for (let file of files) {
                let filesRow = $(`<div id="${file.id}" class="row file-row"></div>`);
                filesRow.append(`<div class="col-xs-1"><img src="${file.iconLink}"></div>`);
                filesRow.append(`<div class="col-xs-5">${file.name}</div>`);
                filesRow.append(`<div class="col-xs-3">${file.owners[0].displayName}</div>`);
                filesRow.append(`<div class="col-xs-3">${file.modifiedTime}</div>`);
                filesContainer.append(filesRow);
            }
            $('.file-row').click(fileRowClickHandler)
        }

        function fileRowClickHandler(event) {
            $(this).toggleClass('checked');
        }
    });
});

