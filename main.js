const ENTER_KEY_CODE = 13;
$(() => {
    'use strict';
    let files = new Map();

    class FilesGrid {
        constructor(container) {
            const headerRow = $('<div class="row files-grid-header"></div>');
            headerRow.append('<div class="col-xs-1"><input id="select-all" type="checkbox" disabled></div>');
            headerRow.append('<div class="col-xs-5">Name</div>');
            headerRow.append('<div class="col-xs-3">Owner</div>');
            headerRow.append('<div class="col-xs-3">Changed</div>');
            container.append(headerRow);
            // @TODO add constanct for 'No files available' label.
            this._filesContainer = $('<div class="files-container">No files available</div>');
            container.append(this._filesContainer);
            $('#select-all').click((event) => {
                if ($(event.delegateTarget).is(':checked')) {
                    this._filesContainer.find('.file-row').addClass('checked');
                } else {
                    this._filesContainer.find('.file-row').removeClass('checked');
                }
                this._notifyOnSelectObservers();
            });
            // Array of callbacks that need to be called on select file.
            this._onSelectFileObservers = [];
        }

        buildGrid() {
            this._filesContainer.empty();
            for (let fileId of files.keys()) {
                // This check is just for avoiding duplicate ids rows.
                let file = files.get(fileId);
                let fileRow = $(`<div id="${file.id}" class="row file-row"></div>`);
                fileRow.append(`<div class="col-xs-1"><img src="${file.iconLink}"></div>`);
                fileRow.append(`<div class="col-xs-5 file-name">${file.name}</div>`);
                fileRow.append(`<div class="col-xs-3">${file.owners[0].displayName}</div>`);
                fileRow.append(`<div class="col-xs-3">${file.modifiedTime}</div>`);
                this._filesContainer.append(fileRow);
            }
            $('.file-row').click((event) => {
                $(event.delegateTarget).toggleClass('checked');
                this._notifyOnSelectObservers();
            });
            if (files.size > 0) {
                $('#select-all').prop("disabled", false);
            } else {
                $('#select-all').prop("disabled", true);
            }
        }

        showPreloader() {
            this._filesContainer.html('<div style="text-align: center"><span class="glyphicon glyphicon-refresh spinner"></span></div>');
        }

        getFileIdsSelected() {
            const fileIds = [];
            this._filesContainer.find('.file-row.checked').each((index, element) => {
                fileIds.push($(element).attr('id'));
            });
            return fileIds;
        }

        _notifyOnSelectObservers() {
            const fileIdsSelected = this.getFileIdsSelected();
            this._onSelectFileObservers.forEach((observer) => observer(fileIdsSelected));
        }

        onSelectFileSubscribe(fn) {
            this._onSelectFileObservers.push(fn);
        }

        onSelectFileUnsubscribe(fn) {
            this._onSelectFileObservers = this._onSelectFileObservers.filter((observer) => observer === fn);
        }


    }

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

        const filesGrid = new FilesGrid($('.files-grid'));
        filesGrid.onSelectFileSubscribe((fileIds) => {
            if (fileIds.length > 0) {
                $('.btn-clone, .btn-remove').prop('disabled', false);
            } else {
                $('.btn-clone, .btn-remove').prop('disabled', true);
            }
        });


        function searchHandler(searchStr, pageToken = '') {
            if (pageToken === '') {
                files = new Map();
                filesGrid.showPreloader();
            }
            return new Promise(resolve => {
                const request = gapi.client.request({
                    'method': 'GET',
                    'path': "/drive/v3/files?",
                    'params': {
                        'fields': 'nextPageToken, files(id, name, parents, iconLink, owners, modifiedTime, size)',
                        'q': `"${searchStr}" in owners and mimeType != "application/vnd.google-apps.folder"`,
                        'pageToken': pageToken
                    }
                });
                request.execute((response) => {
                    console.log(response);
                    if (response.files !== undefined) {
                        for (let file of response.files) {
                            files.set(file.id, file);
                        }
                        const {nextPageToken = false} = response;
                        resolve(nextPageToken);
                    } else {
                        // @TODO handle error here
                    }
                });
            })
                .then(nextPageToken => {
                    if (nextPageToken !== false) {
                        return searchHandler(searchStr, nextPageToken);
                    } else {
                        filesGrid.buildGrid();
                        return Promise.resolve(null)
                    }
                });
        }

        $('#search-box input').keypress(function (event) {
            if (event.which === ENTER_KEY_CODE) {
                // filesContainer.html('<div style="text-align: center"><span class="glyphicon glyphicon-refresh spinner"></span></div>');
                searchHandler($(this).val())
            }
        });

        $('#search-box .btn').click(() => {
            // filesContainer.html('<div style="text-align: center"><span class="glyphicon glyphicon-refresh spinner"></span></div>');
            searchHandler($('#search-box input').val())
        });

        const modalContent = $('.modal-content');

        $('.btn-clone').click(() => {
            modalContent.empty();
            modalContent.append(`<div class="modal-body">Are you sure that you want to clone ${filesGrid.getFileIdsSelected().length} files?</div>`);
            const modalFooter = $('<div class="modal-footer"></div>');
            modalFooter.append('<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>');
            const runCloneBtn = $('<button type="button" class="btn btn-primary">Clone</button>');
            modalFooter.append(runCloneBtn);
            modalContent.append(modalFooter);
            runCloneBtn.click(runCloneBtnClickHandler);
            $('#modal').modal();
        });

        $('.btn-remove').click(() => {
            modalContent.empty();
            modalContent.append(`<div class="modal-body">Are you sure that you want to remove ${filesGrid.getFileIdsSelected().length} files?</div>`);
            const modalFooter = $('<div class="modal-footer"></div>');
            modalFooter.append('<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>');
            const runCloneBtn = $('<button type="button" class="btn btn-primary">Remove</button>');
            modalFooter.append(runCloneBtn);
            modalContent.append(modalFooter);
            runCloneBtn.click(runDeleteButtonClickHandler);
            $('#modal').modal();

        });

        function runCloneBtnClickHandler() {
            modalContent.empty();
            let copyRequestChain = Promise.resolve();
            const filesIdsSelected = filesGrid.getFileIdsSelected();
            let i = 1;
            for (let fileId of filesIdsSelected) {
                let file = files.get(fileId);
                if (file.parents === undefined) {
                    console.log(file);
                }
                if (file.parents !== undefined && file.parents.length > 0) {
                    copyRequestChain = copyRequestChain.then(() => {
                        return new Promise(resolve => {
                            modalContent.html(`<div class="modal-header">
<span class="glyphicon glyphicon-refresh spinner"></span>Processing file ${i} of ${filesIdsSelected.length}: 
<img src="${file.iconLink}"> ${file.name}</div>`);
                            i++;
                            const request = gapi.client.request({
                                'method': 'POST',
                                'path': `/drive/v3/files/${fileId}/copy`,
                                'params': {
                                },
                                'body': {
                                    // Keep name exactly the same. This request adds "Copy" prefix to original file names for Native GD files.
                                    'name': file.name
                                }
                            });
                            request.execute((response) => {
                                console.log(response)
                                resolve();
                            });
                        });
                    });
                }
            }
            copyRequestChain.then(() => {
                $('#modal').modal('hide');
            });
        }

        function runDeleteButtonClickHandler() {
            modalContent.empty();
            let copyRequestChain = Promise.resolve();
            const filesIdsSelected = filesGrid.getFileIdsSelected();
            let i = 1;
            for (let fileId of filesIdsSelected) {
                let file = files.get(fileId);
                if (file.parents === undefined) {
                    console.log(file);
                }
                if (file.parents !== undefined && file.parents.length > 0) {
                    copyRequestChain = copyRequestChain.then(() => {
                        return new Promise(resolve => {
                            modalContent.html(`<div class="modal-header">
<span class="glyphicon glyphicon-refresh spinner"></span>Processing file ${i} of ${filesIdsSelected.length}: 
<img src="${file.iconLink}"> ${file.name}</div>`);
                            i++;
                            const request = gapi.client.request({
                                'method': 'PATCH',
                                'path': `/drive/v3/files/${fileId}`,
                                'params': {
                                    'removeParents': file.parents
                                }
                            });
                            request.execute((response) => {
                                console.log(response)
                                resolve();
                            });
                        });
                    });
                }
            }
            copyRequestChain.then(() => {
                $('#modal').modal('hide');
            });
        }


    });
});

