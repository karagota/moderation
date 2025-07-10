(function() {
    console.log('✅ pendingModeration.ve.js start');

    const initInterval = setInterval(() => {
        if (window.ve && ve.ui && ve.ui.MWMediaDialog) {
            clearInterval(initInterval);
            applyPatches();
        }
    }, 100);

    function applyPatches() {
        console.log('✅ VE is ready, applying custom patches');

        // Полное отключение системных уведомлений о модерации
        // if (ve.init && ve.init.Target && ve.init.Target.prototype.showNotification) {
        //     const origShowNotification = ve.init.Target.prototype.showNotification;
        //     ve.init.Target.prototype.showNotification = function(message) {
        //         if (message.message === 'moderation-image-queued') {
        //             console.log('⚠️ Suppressed system notification');
        //             return;
        //         }
        //         origShowNotification.call(this, message);
        //     };
        // }

        // Блокировка системных уведомлений
        // if (ve.ui.MWUploadBookletLayout && ve.ui.MWUploadBookletLayout.prototype.onUploadError) {
        //     const origOnUploadError = ve.ui.MWUploadBookletLayout.prototype.onUploadError;
        //     ve.ui.MWUploadBookletLayout.prototype.onUploadError = function(error) {
        //         if (error === 'moderation-image-queued') {
        //             console.log('⚠️ Suppressed system notification');
        //             return;
        //         }
        //         origOnUploadError.call(this, error);
        //     };
        // }

        const origSetup = ve.ui.MWMediaDialog.prototype.getSetupProcess;

        ve.ui.MWMediaDialog.prototype.getSetupProcess = function(data) {
            return origSetup.call(this, data)
                .next(() => {
                    if (this.mediaUploadBooklet) {
                        console.log('✅ Attaching upload event handlers');

                        const origCreateUpload = this.mediaUploadBooklet.createUpload;

                        this.mediaUploadBooklet.createUpload = function() {
                            const upload = origCreateUpload.call(this);
                            const booklet = this;

                            const origFinishStashUpload = upload.finishStashUpload;

                            upload.finishStashUpload = function(filekey, filename) {
                                console.log('37:', filekey, filename);
                                return origFinishStashUpload.call(this, filekey, filename)
                                    .then(response => {
                                        console.log('⚙️ Upload finished', response);

                                        if (response.upload && response.moderation === 'pending') {
                                            response.result.type = 'pending';
                                            booklet.emit('uploadModerated', response);
                                        }
                                        return response;
                                    })
                                    .catch(error => {
                                        console.log('⚙️ Upload error', error);

                                        if (error === 'moderation-image-queued') {
                                            let filename = '';
                                            let filekey = '';

                                            if (booklet.upload) {
                                                console.log('moderation-image-queue', booklet.upload);
                                                filename = booklet.upload.filename || '';

                                                if (booklet.upload.stateDetails &&
                                                    booklet.upload.stateDetails.errors &&
                                                    booklet.upload.stateDetails.errors[0] &&
                                                    booklet.upload.stateDetails.errors[0].data) {

                                                    const errorData = booklet.upload.stateDetails.errors[0].data;
                                                    filekey = errorData.filekey || errorData.sessionkey || '';
                                                }
                                            }

                                            booklet.emit('uploadModerated', {
                                                error: true,
                                                result: {
                                                    filename: filename,
                                                    filekey: filekey
                                                }
                                            });
                                        }
                                        return Promise.reject(error);
                                    });
                            }.bind(upload);

                            return upload;
                        }.bind(this.mediaUploadBooklet);

                        this.mediaUploadBooklet.on('uploadModerated', (response) => {
                            console.log('🔄 Upload moderated', response);
                            this.showPendingUpload(response);
                        });
                    }
                });
        };

        ve.ui.MWMediaDialog.prototype.showPendingUpload = function(response) {
            console.log('🔄 Showing pending upload interface', response);

            // Сохраняем контекст диалога
            const dialog = this;

            // Форматируем данные
            const data = response.error ? {
                fileName: response.result.filename,
                moderationTempUrl: 'https://wiki.test/images/moderation-icon.jpg'
            } : {
                fileName: response.upload.filename,
                moderationTempUrl: 'https://wiki.test/images/moderation-icon.jpg'
            };

            // Используем специальный класс для нашего контейнера
            const containerClass = 'moderation-pending-container';

            // Удаляем предыдущий контейнер, если есть
            $(`.${containerClass}`).remove();

            // Создаем новый контейнер
            const $container = $('<div>').addClass(containerClass)
                .css({
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    position: 'relative'
                });

            // Добавляем превью
            if (data.moderationTempUrl) {
                $container.append(
                    $('<div>').css({margin: '0 auto 15px', maxWidth: '200px'}).append(
                        $('<img>')
                            .attr('src', data.moderationTempUrl)
                            .css({
                                maxWidth: '100%',
                                maxHeight: '150px',
                                display: 'block',
                                margin: '0 auto'
                            })
                    )
                );
            }

            // Добавляем сообщение
            $container.append(
                $('<div>')
                    .addClass('moderation-pending-message')
                    .css({
                        fontSize: '1.2em',
                        marginBottom: '20px',
                        color: '#333'
                    })
                    .text('Ваш файл отправлен на модерацию')
            );

            // Добавляем кнопку
            if (data.fileName) {
                $container.append(
                    $('<button>')
                        .addClass('oo-ui-buttonElement-button oo-ui-buttonElement-button-primary')
                        .css({
                            margin: '10px auto',
                            display: 'block',
                            padding: '8px 20px',
                            fontSize: '1em',
                            cursor: 'pointer'
                        })
                        .text('Вставить ссылку')
                        .on('click', () => {
                            // Основной способ: через target.getSurface()
                            const target = dialog.target;

                            if (target && target.getSurface) {
                                const surface = target.getSurface();

                                if (surface && surface.execute) {
                                    try {
                                        surface.execute('insertContent', `[[File:${data.fileName}]]`);
                                        dialog.close();
                                        return;
                                    } catch (e) {
                                        console.error('Error executing surface.insertContent', e);
                                    }
                                }
                            }

                            // Альтернативный способ: через fragment.insertContent()
                            if (dialog.getFragment && dialog.getFragment().insertContent) {
                                try {
                                    dialog.getFragment().insertContent(`[[File:${data.fileName}]]`);
                                    dialog.close();
                                    return;
                                } catch (e) {
                                    console.error('Error executing fragment.insertContent', e);
                                }
                            }

                            // Крайний вариант: prompt
                            prompt('Скопируйте ссылку на файл', `[[File:${data.fileName}]]`);
                            dialog.close();
                        })
                );
            }

            // Вставляем контейнер в диалог
            this.$body.append($container);

            // Обновляем заголовок
            this.title.setLabel('Файл на модерации!');
            console.log('✅ Custom UI added to dialog body');
        };
    }
})();
