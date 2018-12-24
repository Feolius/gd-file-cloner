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

        const filesContainer = $('.files-container');

        function searchHandler(searchStr) {
            filesContainer.html('<div style="text-align: center"><span class="glyphicon glyphicon-refresh spinner"></span></div>');
            const request = gapi.client.request({
                'method': 'GET',
                'path': "/drive/v3/files?",
                'params': {
                    'fields': 'nextPageToken, files(id, name, parents, iconLink, owners, modifiedTime, size)',
                    'q': `"${searchStr}" in owners and mimeType != "application/vnd.google-apps.folder"`
                }
            });
            request.execute((response) => {
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
                filesRow.append(`<div class="col-xs-5 file-name">${file.name}</div>`);
                filesRow.append(`<div class="col-xs-3">${file.owners[0].displayName}</div>`);
                filesRow.append(`<div class="col-xs-3">${file.modifiedTime}</div>`);
                filesRow.append(`<div class="hidden file-parents">${file.parents[0]}</div>`);
                filesRow.append(`<div class="hidden file-id">${file.id}</div>`);
                filesContainer.append(filesRow);
            }
            $('.file-row').click(fileRowClickHandler)
        }

        function fileRowClickHandler(event) {
            $(this).toggleClass('checked');
            if ($('.file-row.checked').length > 0) {
                $('.btn-clone').prop('disabled', false);
            } else {
                $('.btn-clone').prop('disabled', true);
            }
        }

        $('.btn-clone').click(() => {
            const modalContent = $('.modal-content');
            modalContent.empty();
            modalContent.append(`<div class="modal-body">Are you sure that you want to clone ${$('.file-row.checked').length} files?</div>`);
            const modalFooter = $('<div class="modal-footer"></div>');
            modalFooter.append('<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>');
            const runCloneBtn = $('<button type="button" class="btn btn-primary">Save changes</button>');
            modalFooter.append(runCloneBtn);
            modalContent.append(modalFooter);
            runCloneBtn.click(runCloneBtnClickHandler);
            $('#modal').modal();
        });

        function runCloneBtnClickHandler() {
            const modalContent = $('.modal-content');
            modalContent.empty();
            modalContent.append(`<div class="modal-body"><span class="glyphicon glyphicon-refresh spinner"></span>Processing file</div>`);
            let copyRequestChain = Promise.resolve();
            $('.file-row.checked').each((index, element) => {
                let fileId = $(element).find('.file-id').html();
                let parent = $(element).find('.file-parents').html();
                copyRequestChain = copyRequestChain.then(() => {
                    return new Promise(resolve => {
                        const request = gapi.client.request({
                            'method': 'POST',
                            'path': `/drive/v3/files/${fileId}/copy`,
                            'params': {
                                'parents': [parent]
                            }
                        });
                        request.execute((response) => {
                            console.log(response)
                            resolve();
                        });
                    });
                });
            });
            copyRequestChain.then(() => {$('#modal').modal('hide');});
        }


    });
});

